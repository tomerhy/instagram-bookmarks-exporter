/**
 * Saved Posts Backup & Export - gallery page
 *
 * Reads the captured library straight from chrome.storage.local (it never
 * talks to the content script) and renders it. Two things here are security
 * relevant:
 *   - every string that reaches innerHTML goes through escapeHtml()
 *   - every URL that is fetched, rendered or opened goes through the shared
 *     allowlist in url-allowlist.js, including URLs arriving via Import,
 *     which is the one place a user can hand us a file we did not write
 */

// DOM Elements
var grid = document.getElementById("grid");
var player = document.getElementById("player");
var imageViewer = document.getElementById("image-viewer");
var viewerPlaceholder = document.getElementById("viewer-placeholder");
var statusEl = document.getElementById("status");
var progressBar = document.getElementById("progress-bar");
var imageCountEl = document.getElementById("image-count");
var videoCountEl = document.getElementById("video-count");
var paginationEl = document.getElementById("pagination");
var versionEl = document.getElementById("version");

// State
var ITEMS_PER_PAGE = 50;
var currentTab = "images";
var currentPage = 1;
var allMedia = { images: [], videos: [] };
var currentItem = null;
var selectedCard = null;
// At most one carousel can be expanded at a time. Tracking the DOM node lets
// us collapse the previous one before expanding a new one.
var expandedCard = null;
// Active search query. Empty = no filter applied.
var searchQuery = "";
// Active sort key. 'default' preserves capture order.
// Allowed values: 'default' | 'date_desc' | 'date_asc' | 'owner' | 'likes'.
var sortBy = "default";

// Debug
function logDebug(msg) {
  console.log('[Gallery]', msg);
}

// ---------------------------------------------------------------------------
// URL SINK GUARDS
// ---------------------------------------------------------------------------
// Defence in depth. library-sanitize.js already rebuilds every record that
// enters the process, but these are applied AGAIN at each sink, so that a
// single missed sanitisation path cannot re-expose img.src, video.src,
// window.open, fetch, the clipboard or the exports.
//
// Deliberately NOT written as "storage was sanitised, so this is fine".
// Every one of these returns null rather than a raw value, so a caller that
// forgets to check gets an empty sink instead of a hostile URL.

function safeMediaUrl(value) {
  var a = globalThis.SBE_URL;
  if (!a || typeof a.isAllowedMediaUrl !== 'function') return null;
  try { return a.isAllowedMediaUrl(value) ? value : null; } catch (e) { return null; }
}

function safePostUrl(value) {
  var a = globalThis.SBE_URL;
  if (!a || typeof a.isAllowedPostUrl !== 'function') return null;
  try { return a.isAllowedPostUrl(value) ? value : null; } catch (e) { return null; }
}

// Anything the user is navigated to in a new tab. Only permalinks qualify —
// never a raw media URL, which is why this is separate from safeMediaUrl.
function safeExternalNavigationUrl(value) {
  return safePostUrl(value);
}

// Same guard, for the URL lists that leave the extension via the clipboard or
// an export file. An unsafe URL must not be handed to another application.
function safeExportUrl(value) {
  return safeMediaUrl(value) || safePostUrl(value);
}

// Check if URL is a playable video URL (CDN URL, not Instagram post URL)
function isPlayableVideoUrl(url) {
  // Allowlist FIRST. The substring checks below only distinguish a video asset
  // from a still image; they are not a security boundary and never were —
  // "cdninstagram" matches evilcdninstagram.com too.
  if (!safeMediaUrl(url)) return false;
  return (url.includes('.mp4') || url.includes('/v/') || url.includes('video'));
}


// Helper functions
// The accessors are themselves guarded, so every caller gets a validated value
// or null. This is the cheapest place to close the whole class of bug: most
// sinks read through one of these three.
function getUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return safeMediaUrl(item);
  return safeMediaUrl(item.url) || safeMediaUrl(item.thumbnail) || safePostUrl(item.postUrl);
}

function getThumbnail(item) {
  if (!item) return null;
  if (typeof item === 'string') return safeMediaUrl(item);
  return safeMediaUrl(item.thumbnail) || safeMediaUrl(item.url);
}

function getPostUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return null;
  return safePostUrl(item.postUrl);
}

// Media bytes only — never a permalink. Used where the value goes into
// player.src / <img src> / fetch(), which must not receive an instagram.com
// page URL.
function getMediaUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return safeMediaUrl(item);
  return safeMediaUrl(item.url) || safeMediaUrl(item.thumbnail);
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}

function setProgress(val) {
  if (progressBar) progressBar.style.width = Math.max(0, Math.min(100, val)) + "%";
}

// Escape user-supplied strings before injecting into innerHTML.
// Captions and usernames come from Instagram and may contain HTML special chars.
// Small DOM builder used by the render paths that previously concatenated
// HTML strings. textContent means a caption or username is never parsed as
// markup, so no escaping step can be forgotten.
function el(tag, className, text) {
  let node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

// escapeHtml is retained for the remaining static-template call sites and as a
// belt-and-braces helper. New code should prefer el() + textContent.
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Get items for the current tab, grouped by post.
// Items sharing a postShortcode collapse into a single "cover" entry that
// carries _carouselSlides (sorted by carouselIndex) and carouselSize. Items
// without a shortcode (legacy data captured before v4.3) pass through as
// individual entries. Capture order is preserved by remembering the first
// occurrence of each group.
function getCurrentItems() {
  let items = currentTab === "images" ? allMedia.images : allMedia.videos;
  // Items inside the same post dedupe by (shortcode, carouselIndex) so that a
  // slide URL matching the cover URL doesn't drop the slide. Items without a
  // shortcode (legacy data captured pre-v4.3) dedupe by URL.
  let seenWithinPost = {};
  let seenUrl = {};
  let groupOrder = [];
  let groupMap = {};

  for (var i = 0; i < items.length; i++) {
    let item = items[i];
    let url = getUrl(item);
    if (!url) continue;

    if (item && item.postShortcode) {
      let idx = (item.carouselIndex == null) ? 'cover' : item.carouselIndex;
      let slotKey = item.postShortcode + ':' + idx;
      if (seenWithinPost[slotKey]) continue;
      seenWithinPost[slotKey] = true;
    } else {
      if (seenUrl[url]) continue;
      seenUrl[url] = true;
    }

    let key = (item && item.postShortcode) ? ("post:" + item.postShortcode) : ("item:" + url);
    if (!groupMap[key]) {
      groupMap[key] = [];
      groupOrder.push(key);
    }
    groupMap[key].push(item);
  }

  return groupOrder.map(function(key) {
    let slides = groupMap[key];
    if (slides.length === 1) return slides[0];
    let sorted = slides.slice().sort(function(a, b) {
      let ai = (a.carouselIndex == null) ? 0 : a.carouselIndex;
      let bi = (b.carouselIndex == null) ? 0 : b.carouselIndex;
      return ai - bi;
    });
    return Object.assign({}, sorted[0], {
      _carouselSlides: sorted,
      carouselSize: sorted.length
    });
  });
}

// ----------------------------------------------------------------------------
// Search — case-insensitive substring filter across owner / caption / hashtags.
//
// Token prefixes:
//   @user  → match owner only
//   #tag   → match hashtags only
//   bare   → match across all three
// Multiple space-separated tokens are AND-ed. An empty query matches all.
// Items without metadata are filtered out as soon as the query is non-empty.
// ----------------------------------------------------------------------------

function _searchTokenize(query) {
  return String(query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function _itemSearchHaystack(item) {
  let meta = (item && item.metadata) || null;
  let owner = (meta && meta.owner) ? String(meta.owner).toLowerCase() : "";
  let caption = (meta && meta.caption) ? String(meta.caption).toLowerCase() : "";
  let hashtags = (meta && Array.isArray(meta.hashtags))
    ? meta.hashtags.map(function (t) { return String(t).toLowerCase(); })
    : [];
  return { owner: owner, caption: caption, hashtags: hashtags };
}

function _tokenMatches(token, hay) {
  if (token.charAt(0) === "@") {
    let name = token.slice(1);
    return name.length > 0 && hay.owner.indexOf(name) !== -1;
  }
  if (token.charAt(0) === "#") {
    let tag = token.slice(1);
    if (!tag) return false;
    for (var i = 0; i < hay.hashtags.length; i++) {
      if (hay.hashtags[i].indexOf(tag) !== -1) return true;
    }
    return false;
  }
  if (hay.owner.indexOf(token) !== -1) return true;
  if (hay.caption.indexOf(token) !== -1) return true;
  for (var j = 0; j < hay.hashtags.length; j++) {
    if (hay.hashtags[j].indexOf(token) !== -1) return true;
  }
  return false;
}

function matchesQuery(item, query) {
  let tokens = _searchTokenize(query);
  if (!tokens.length) return true;
  // Items without metadata can't match any non-empty query.
  if (!item || !item.metadata) return false;
  let hay = _itemSearchHaystack(item);
  for (var i = 0; i < tokens.length; i++) {
    if (!_tokenMatches(tokens[i], hay)) return false;
  }
  return true;
}

// Filter the grouped current-tab items by the active search query.
// Carousel grouping happens upstream (getCurrentItems), so each filtered
// entry already represents an album cover when applicable.
function getFilteredItems() {
  let items = getCurrentItems();
  if (searchQuery) {
    items = items.filter(function (it) { return matchesQuery(it, searchQuery); });
  }
  return applySort(items, sortBy);
}

// Sort items by metadata. Items lacking the sort field always sink to the
// bottom (regardless of direction), so a single bad item doesn't poison the
// top of the list. Pure function: returns a new array, doesn't mutate input.
//
// Stability: when items have equal sort keys (or both lack the field), the
// original capture order is preserved.
function applySort(items, key) {
  if (!Array.isArray(items) || items.length === 0) return items;
  if (!key || key === "default") return items;

  // Pre-compute (key, index) tuples so we can sort by key with a stable
  // tiebreaker on original index.
  let tuples = items.map(function (it, i) {
    return { it: it, i: i, k: _sortKey(it, key) };
  });

  tuples.sort(function (a, b) {
    let aMissing = a.k === null || a.k === undefined;
    let bMissing = b.k === null || b.k === undefined;
    if (aMissing && bMissing) return a.i - b.i;
    if (aMissing) return 1;   // missing → bottom
    if (bMissing) return -1;
    if (a.k < b.k) return -1;
    if (a.k > b.k) return 1;
    return a.i - b.i;          // stable tiebreaker
  });

  // For descending keys, reverse — but keep missing-at-bottom by splitting.
  if (key === "date_desc" || key === "likes") {
    let present = tuples.filter(function (t) { return t.k !== null && t.k !== undefined; });
    let missing = tuples.filter(function (t) { return t.k === null || t.k === undefined; });
    present.reverse();
    tuples = present.concat(missing);
  }

  return tuples.map(function (t) { return t.it; });
}

// Per-key extractor. Returns a comparable value, or null when the item
// lacks the field. Centralized so sort behavior is testable in isolation.
function _sortKey(item, key) {
  let meta = item && item.metadata;
  switch (key) {
    case "date_desc":
    case "date_asc": {
      let d = meta && meta.takenAt ? new Date(meta.takenAt).getTime() : null;
      return (d === null || isNaN(d)) ? null : d;
    }
    case "owner": {
      let o = meta && meta.owner ? String(meta.owner).toLowerCase() : null;
      return o || null;
    }
    case "likes": {
      let n = meta && typeof meta.likeCount === "number" ? meta.likeCount : null;
      return n;
    }
    default:
      return null;
  }
}

function setSortBy(key) {
  let next = String(key || "default");
  if (next === sortBy) return;
  sortBy = next;
  currentPage = 1;
  let sel = document.getElementById("sort-select");
  if (sel) {
    if (sel.value !== next) sel.value = next;
    sel.classList.toggle("is-active", next !== "default");
  }
  // Collapse any expanded carousel instantly — re-sorted positions could
  // otherwise leave a drawer attached to a now-out-of-view card.
  if (typeof collapseCarousel === "function") collapseCarousel({ instant: true });
  renderGrid();
}

// Centralized setter. Resets to page 1 (otherwise we could be stuck on a
// page beyond the filtered total), updates the input/clear/meta UI, and
// re-renders the grid.
function setSearchQuery(value) {
  let next = String(value || "");
  if (next === searchQuery) return;
  searchQuery = next;
  currentPage = 1;
  // Keep the input in sync if the change came from somewhere other than typing
  let input = document.getElementById("search-input");
  if (input && input.value !== next) input.value = next;
  let clearBtn = document.getElementById("search-clear");
  if (clearBtn) clearBtn.hidden = next.length === 0;
  // Selection may reference a now-filtered-out card; drop it.
  if (next) {
    if (selectedCard) {
      selectedCard.classList.remove("selected");
      selectedCard.setAttribute("aria-pressed", "false");
      selectedCard = null;
    }
  }
  collapseCarousel({ instant: true });
  renderGrid();
}

// "Showing N of M results for '...'" row beneath the toolbar. Hidden when
// the query is empty.
function renderSearchMeta(filtered, total) {
  let meta = document.getElementById("search-meta");
  if (!meta) return;
  if (!searchQuery) {
    meta.hidden = true;
    meta.innerHTML = "";
    return;
  }
  meta.hidden = false;
  let span = document.createElement("span");
  if (filtered === total) {
    span.appendChild(el("strong", null, filtered));
    span.appendChild(document.createTextNode(
      " " + (filtered === 1 ? "result" : "results") + " for "));
  } else {
    span.appendChild(document.createTextNode("Showing "));
    span.appendChild(el("strong", null, filtered));
    span.appendChild(document.createTextNode(" of "));
    span.appendChild(el("strong", null, total));
    span.appendChild(document.createTextNode(
      " " + (total === 1 ? "item" : "items") + " for "));
  }
  // The query is the user's own input, but it goes in as text, not markup.
  span.appendChild(el("strong", null, searchQuery));

  let clear = document.createElement("button");
  clear.className = "search-meta-clear";
  clear.type = "button";
  clear.textContent = "Clear";
  clear.onclick = function () { setSearchQuery(""); };

  meta.replaceChildren(span, clear);
}

// Render the metadata block under the viewer (caption, owner, date, album size).
// No-op when the item has no metadata (legacy items pre-v4.3).
function renderViewerMeta(item) {
  // Named `target`, not `el`: `el` is the DOM-builder helper above, and
  // shadowing it here would silently break every el(...) call in this function.
  let target = document.getElementById("viewer-meta");
  if (!target) return;

  let meta = item && item.metadata;
  let hasAlbum = item && item.carouselSize && item.carouselSize > 1;

  if (!meta && !hasAlbum) {
    target.classList.remove("visible");
    target.replaceChildren();
    return;
  }

  // Built as DOM nodes. The owner and caption are untrusted strings from a
  // captured post, and they enter as textContent — never as markup.
  let parts = [];
  if (meta && meta.owner) parts.push(el("span", "vm-owner", "@" + meta.owner));
  if (meta && meta.takenAt) {
    let d = new Date(meta.takenAt);
    if (!isNaN(d.getTime())) parts.push(el("span", "vm-date", d.toLocaleDateString()));
  }
  if (hasAlbum) {
    parts.push(el("span", "vm-album", "\u{1F4F7} " + item.carouselSize + " slides"));
  }

  let children = [];
  if (parts.length) {
    let head = el("div", "vm-head");
    parts.forEach(function (node, i) {
      if (i) head.appendChild(document.createTextNode(" \u00B7 "));
      head.appendChild(node);
    });
    children.push(head);
  }
  if (meta && meta.caption) {
    let c = meta.caption.length > 280 ? meta.caption.slice(0, 280) + "\u2026" : meta.caption;
    children.push(el("div", "vm-caption", c));
  }

  target.replaceChildren.apply(target, children);
  target.classList.add("visible");
}

// Update counts
function updateCounts() {
  let images = allMedia.images.length;
  let videos = allMedia.videos.length;
  if (imageCountEl) imageCountEl.textContent = images;
  if (videoCountEl) videoCountEl.textContent = videos;
  
  // Count how many videos have playable URLs
  let playableVideos = allMedia.videos.filter(function(v) {
    return isPlayableVideoUrl(getUrl(v));
  }).length;
  
  logDebug("Counts: " + images + " images, " + videos + " videos (" + playableVideos + " playable)");
  
  // Show first video details for debugging
  if (allMedia.videos.length > 0) {
    let v = allMedia.videos[0];
    logDebug("First video: url=" + (v.url ? v.url.substring(0, 50) : "null") + ", postUrl=" + (v.postUrl || "null"));
  }
}

// ----------------------------------------------------------------------------
// Carousel inline expansion — clicking the album badge on a card opens an
// in-grid horizontal strip of all its slides without leaving the gallery.
// ----------------------------------------------------------------------------

// Safely read the carousel slide list off a grouped item. Returns [] when the
// item isn't an album, which is the convenient empty-iterate case.
function getCarouselSlides(item) {
  if (!item || !item._carouselSlides) return [];
  return item._carouselSlides;
}

// Build the markup for the horizontal slide strip. Pure-ish: takes an array
// of slide items and returns an HTMLElement. No globals touched.
// Each slide gets a --i CSS custom property which the strip's keyframes use
// to stagger the slide-in animation (slide 0 fires first, slide 5 fires last).
function buildCarouselStrip(slides) {
  let strip = document.createElement("div");
  strip.className = "carousel-strip";
  strip.setAttribute("role", "list");
  strip.setAttribute("aria-label", "Album slides");

  for (var i = 0; i < slides.length; i++) {
    let slide = slides[i];
    let thumbUrl = (slide && (slide.thumbnail || slide.url)) || "";
    let slideEl = document.createElement("button");
    slideEl.className = "carousel-strip-slide";
    slideEl.setAttribute("role", "listitem");
    slideEl.setAttribute("aria-label", "Slide " + (i + 1) + " of " + slides.length);
    slideEl.setAttribute("data-slide-index", i);
    // Stagger index for the keyframe delay (capped so a 50-slide album
    // doesn't take 2.5 seconds to settle).
    if (slideEl.style) slideEl.style.setProperty("--i", String(Math.min(i, 10)));
    let img = document.createElement("img");
    img.src = safeMediaUrl(thumbUrl) || "";
    img.loading = "lazy";
    img.alt = "";
    slideEl.appendChild(img);
    strip.appendChild(slideEl);
  }
  return strip;
}

// Animated by default. Pass { instant: true } when snapping closed is the
// right UX (Clear All, tab switch, opening a different album mid-flight).
function collapseCarousel(opts) {
  if (!expandedCard) return;
  let instant = !!(opts && opts.instant);
  let card = expandedCard;
  // Free the slot immediately so a re-expand on the same card during the
  // close animation can race in without false "already expanded" guards.
  expandedCard = null;

  let drawer = card.querySelector(".carousel-drawer:not(.is-closing)");

  function finishClose() {
    if (drawer && drawer.parentNode) drawer.remove();
    // Belt-and-braces: drop any stray bare strip too (defensive).
    let stray = card.querySelector(".carousel-strip");
    if (stray) stray.remove();
    // Only collapse the card if no new expansion has reclaimed it.
    if (expandedCard !== card) {
      card.classList.remove("carousel-expanded");
      card.setAttribute("aria-expanded", "false");
    }
  }

  if (instant || !drawer) {
    finishClose();
    return;
  }

  drawer.classList.add("is-closing");
  let done = false;
  function once() { if (!done) { done = true; finishClose(); } }
  drawer.addEventListener("animationend", once, { once: true });
  // Fallback if animationend never fires — e.g. prefers-reduced-motion
  // collapses transitions to 0.01ms and may not always emit the event.
  // Slightly longer than the CSS animation (320ms) to avoid finalizing early.
  setTimeout(once, 420);
}

function expandCarousel(card, item) {
  // Only one expanded at a time — snap the predecessor closed so the new
  // album's enter animation doesn't fight the old one's exit.
  if (expandedCard && expandedCard !== card) collapseCarousel({ instant: true });

  // Toggle off if it's already expanded — let this one animate out.
  if (expandedCard === card) {
    collapseCarousel();
    return;
  }

  let slides = getCarouselSlides(item);
  if (!slides.length) return;

  // Build the drawer: header with album count + close, then the strip.
  let drawer = document.createElement("div");
  drawer.className = "carousel-drawer";

  let header = document.createElement("div");
  header.className = "carousel-drawer-header";
  header.innerHTML =
    '<span class="carousel-drawer-title">' +
      '<strong>' + slides.length + '</strong> slides' +
    '</span>';

  // Download-album button — bundles all slides + manifest.json into a zip.
  let downloadBtn = document.createElement("button");
  downloadBtn.className = "carousel-drawer-download";
  downloadBtn.setAttribute("aria-label", "Download album as zip");
  downloadBtn.title = "Download album as zip";
  downloadBtn.innerHTML = '<svg class="icon-sm" aria-hidden="true"><use href="#i-download"/></svg><span>Download album</span>';
  downloadBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    downloadAlbum(item);
  });
  header.appendChild(downloadBtn);

  let closeBtn = document.createElement("button");
  closeBtn.className = "carousel-drawer-close";
  closeBtn.setAttribute("aria-label", "Collapse album");
  closeBtn.title = "Close";
  closeBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-x"/></svg>';
  closeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    collapseCarousel();
  });
  header.appendChild(closeBtn);
  drawer.appendChild(header);

  let strip = buildCarouselStrip(slides);
  drawer.appendChild(strip);

  // Clicking a slide thumb previews it in the viewer.
  drawer.addEventListener("click", function (e) {
    let btn = e.target.closest(".carousel-strip-slide");
    if (!btn) return;
    e.stopPropagation();
    let idx = parseInt(btn.getAttribute("data-slide-index"), 10);
    let slide = slides[idx];
    if (!slide) return;
    if (currentTab === "videos") {
      showVideo(slide);
    } else {
      showImage(slide);
    }
    let prev = strip.querySelector(".carousel-strip-slide.active");
    if (prev) prev.classList.remove("active");
    btn.classList.add("active");
  });

  card.appendChild(drawer);
  card.classList.add("carousel-expanded");
  card.setAttribute("aria-expanded", "true");
  expandedCard = card;
}

// Reset the viewer back to "nothing selected". Called when data is cleared
// so the previously-displayed video doesn't keep playing in the background
// and the metadata strip doesn't linger pointing at a deleted item.
function resetViewer() {
  if (player) {
    try { player.pause(); } catch (_) {}
    player.removeAttribute("src");
    player.src = "";
    try { player.load(); } catch (_) {}
    player.style.display = "none";
  }
  if (imageViewer) {
    imageViewer.removeAttribute("src");
    imageViewer.src = "";
    imageViewer.style.display = "none";
  }
  if (viewerPlaceholder) {
    viewerPlaceholder.style.display = "flex";
    viewerPlaceholder.innerHTML = "Select an item to preview";
  }
  let meta = document.getElementById("viewer-meta");
  if (meta) {
    meta.classList.remove("visible");
    meta.innerHTML = "";
  }
  if (typeof stopSlideshow === "function") stopSlideshow();
  // Clearing data is a hard reset; snap the carousel closed, don't animate.
  if (typeof collapseCarousel === "function") collapseCarousel({ instant: true });
  currentItem = null;
  selectedCard = null;
}

// Show image in viewer
function showImage(item) {
  let url = safeMediaUrl(getMediaUrl(item));
  if (!url) {
    // An image record whose media URL did not survive validation shows the
    // post-link fallback rather than a broken or hostile <img>.
    showVideoFallback(getPostUrl(item), null);
    currentItem = item;
    renderViewerMeta(item);
    return;
  }

  if (player) { player.pause(); player.style.display = "none"; }
  if (viewerPlaceholder) viewerPlaceholder.style.display = "none";
  if (imageViewer) {
    imageViewer.style.display = "block";
    imageViewer.src = safeMediaUrl(url) || "";
  }
  currentItem = item;
  renderViewerMeta(item);
}

// Show video in viewer
function showVideo(item) {
  // getMediaUrl, not getUrl: getUrl can fall back to a permalink, which must
  // never be assigned to player.src.
  let url = getMediaUrl(item);
  let postUrl = getPostUrl(item);
  let thumb = getThumbnail(item);
  
  logDebug("Video item: url=" + (url ? url.substring(0, 60) + "..." : "null") + ", postUrl=" + (postUrl || "null"));
  
  if (imageViewer) imageViewer.style.display = "none";
  if (player) { player.pause(); player.src = ""; }
  
  // Check if we have a playable CDN video URL
  let playable = isPlayableVideoUrl(url);
  
  if (playable) {
    logDebug("Attempting to play video...");
    if (viewerPlaceholder) viewerPlaceholder.style.display = "none";
    if (player) {
      player.style.display = "block";
      player.src = safeMediaUrl(url) || "";
      player.load();
      player.play().catch(function(e) {
        logDebug("Play error: " + e.message);
        // Show fallback on error
        showVideoFallback(postUrl || url, thumb);
      });
    }
  } else {
    // No direct video URL - show thumbnail with link
    showVideoFallback(postUrl || url, thumb);
  }

  currentItem = item;
  renderViewerMeta(item);
}

// Built with DOM APIs, not string concatenation. Nothing here interpolates a
// URL into markup, so there is no attribute to break out of and no way for a
// stored value to become HTML. Both URLs are re-validated at this sink even
// though the record was sanitised on load.
function showVideoFallback(linkUrl, thumbnailUrl) {
  if (player) player.style.display = "none";
  if (!viewerPlaceholder) return;
  viewerPlaceholder.style.display = "flex";

  let safeThumb = safeMediaUrl(thumbnailUrl);
  let safeLink = safeExternalNavigationUrl(linkUrl);

  let box = document.createElement("div");
  box.className = "video-fallback";

  // Thumbnail only when it is a genuine allowlisted media URL. Otherwise a
  // static glyph — never the rejected value, in any form.
  if (safeThumb) {
    let img = document.createElement("img");
    img.className = "video-fallback-thumb";
    img.alt = "";
    img.src = safeMediaUrl(thumbnailUrl) || "";
    // A thumbnail that fails to load falls back to the glyph rather than
    // leaving a broken-image icon.
    img.addEventListener("error", function () {
      let glyph = document.createElement("div");
      glyph.className = "video-fallback-glyph";
      glyph.textContent = "\u{1F3AC}";
      if (img.parentNode) img.parentNode.replaceChild(glyph, img);
    });
    box.appendChild(img);
  } else {
    let glyph = document.createElement("div");
    glyph.className = "video-fallback-glyph";
    glyph.textContent = "\u{1F3AC}";
    box.appendChild(glyph);
  }

  let msg = document.createElement("p");
  msg.className = "video-fallback-msg";
  msg.textContent = "The direct video file is not available. This can happen "
    + "when a captured link has expired.";
  box.appendChild(msg);

  // "Open original post" only for a real permalink. A raw media URL is
  // explicitly NOT offered here: it is not a post, and offering it would
  // navigate the user to a bare CDN asset.
  if (safeLink) {
    let a = document.createElement("a");
    a.className = "btn-link";
    a.href = safeExternalNavigationUrl(linkUrl) || "";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Open original post";
    box.appendChild(a);
  } else {
    let note = document.createElement("p");
    note.className = "video-fallback-note";
    note.textContent = "No original post link was captured for this item.";
    box.appendChild(note);
  }

  viewerPlaceholder.replaceChildren(box);
}

// Render grid
function renderGrid() {
  if (!grid) return;
  grid.innerHTML = "";

  let unfilteredCount = getCurrentItems().length;
  let items = getFilteredItems();
  let totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

  renderSearchMeta(items.length, unfilteredCount);

  if (items.length === 0) {
    if (searchQuery) {
      // Distinct empty state for "no matches" vs "no captures yet"
      let box = el("div", "empty-state");
      let icon = el("div", "es-icon", "\u{1F50E}");
      icon.setAttribute("aria-hidden", "true");
      box.appendChild(icon);
      box.appendChild(el("h3", null, "No matches"));
      let p = el("p");
      p.appendChild(document.createTextNode("No " + currentTab + " match "));
      p.appendChild(el("strong", null, searchQuery));
      p.appendChild(document.createTextNode(
        ". Try different keywords, or use @user / #tag to narrow the field."));
      box.appendChild(p);
      let clearBtn = el("button", "btn-link", "Clear search");
      clearBtn.id = "empty-clear-search";
      box.appendChild(clearBtn);
      grid.replaceChildren(box);
      if (clearBtn) clearBtn.onclick = function () {
        setSearchQuery("");
      };
    } else {
      let emptyIcon = currentTab === "videos" ? "▶" : "🖼";
      grid.innerHTML =
        '<div class="empty-state">' +
          '<div class="es-icon" aria-hidden="true">' + emptyIcon + '</div>' +
          '<h3>No ' + currentTab + ' captured yet</h3>' +
          '<p>Open Instagram and scroll through your <strong>saved posts</strong> — ' +
          'captures appear here automatically as you go.</p>' +
          '<a class="btn-link" href="https://www.instagram.com/" target="_blank" rel="noopener">Open Instagram</a>' +
        '</div>';
    }
    if (viewerPlaceholder) {
      viewerPlaceholder.style.display = "flex";
      viewerPlaceholder.innerHTML = "Select an item to preview";
    }
    renderPagination(0);
    return;
  }
  
  let start = (currentPage - 1) * ITEMS_PER_PAGE;
  let end = Math.min(start + ITEMS_PER_PAGE, items.length);
  let pageItems = items.slice(start, end);
  
  pageItems.forEach(function(item, idx) {
    let globalIdx = start + idx;
    let card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-index", globalIdx);
    // Subtle entrance stagger — cards wave in over ~600ms total. Capped so
    // pages with hundreds of items don't get a 3-second cascade.
    card.style.animationDelay = Math.min(idx * 28, 600) + "ms";
    // Keyboard accessibility: cards are interactive, must be tabbable +
    // announced as buttons + report selection state to assistive tech.
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-pressed", "false");
    let ownerForLabel = (item.metadata && item.metadata.owner) ? " by @" + item.metadata.owner : "";
    let sizeForLabel = (item.carouselSize && item.carouselSize > 1) ? ", album of " + item.carouselSize : "";
    card.setAttribute(
      "aria-label",
      (currentTab === "videos" ? "Video " : "Image ") + (globalIdx + 1) + ownerForLabel + sizeForLabel
    );
    
    let thumbUrl = getThumbnail(item) || getUrl(item);
    
    if (currentTab === "videos") {
      // Video thumbnail
      if (thumbUrl && thumbUrl.indexOf(".mp4") === -1) {
        let img = document.createElement("img");
        img.className = "thumb";
        img.src = safeMediaUrl(thumbUrl) || "";
        img.loading = "lazy";
        img.onerror = function() {
          this.outerHTML = '<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:#222;"><span style="font-size:40px;">▶</span></div>';
        };
        card.appendChild(img);
      } else {
        let placeholder = document.createElement("div");
        placeholder.className = "thumb";
        placeholder.style.cssText = "display:flex;align-items:center;justify-content:center;background:#222;";
        placeholder.innerHTML = '<span style="font-size:40px;">▶</span>';
        card.appendChild(placeholder);
      }
      
      let badge = document.createElement("div");
      badge.className = "video-badge";
      badge.textContent = "▶ Video";
      card.appendChild(badge);
    } else {
      // Image thumbnail
      let img = document.createElement("img");
      img.className = "thumb";
      img.src = safeMediaUrl(thumbUrl) || "";
      img.loading = "lazy";
      img.onerror = function() {
        this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3C/svg%3E";
      };
      card.appendChild(img);
    }

    // Carousel indicator — Instagram's own two-square glyph + count, no pill
    // background. Click expands the card into a horizontal slide drawer.
    if (item.carouselSize && item.carouselSize > 1) {
      let carBadge = document.createElement("button");
      carBadge.className = "carousel-indicator";
      carBadge.innerHTML =
        '<span class="ci-count">' + item.carouselSize + '</span>' +
        '<svg class="ci-icon" aria-hidden="true"><use href="#i-stack"/></svg>';
      carBadge.setAttribute("aria-label",
        "Show all " + item.carouselSize + " album slides");
      carBadge.setAttribute("aria-expanded", "false");
      carBadge.title = "Show all " + item.carouselSize + " slides";
      carBadge.addEventListener("click", function(e) {
        // Don't trigger the card's own click (which would just select it).
        e.stopPropagation();
        let wasExpanded = card.classList.contains("carousel-expanded");
        expandCarousel(card, item);
        carBadge.setAttribute("aria-expanded",
          card.classList.contains("carousel-expanded") ? "true" : "false");
      });
      card.appendChild(carBadge);
    }

    // Owner overlay (only when metadata is present)
    if (item.metadata && item.metadata.owner) {
      let ovl = document.createElement("div");
      ovl.className = "meta-overlay";
      ovl.innerHTML = '<div class="meta-owner">@' + escapeHtml(item.metadata.owner) + '</div>';
      card.appendChild(ovl);
    }

    card.onclick = function() {
      if (selectedCard) {
        selectedCard.classList.remove("selected");
        selectedCard.setAttribute("aria-pressed", "false");
      }
      card.classList.add("selected");
      card.setAttribute("aria-pressed", "true");
      selectedCard = card;

      if (currentTab === "videos") {
        showVideo(item);
      } else {
        showImage(item);
      }

      // Skip the auto-select firing on first render — only count real clicks.
      if (card.dataset.autoSelect === "true") {
        delete card.dataset.autoSelect;
        return;
      }
    };
    // Enter or Space activates the card from the keyboard
    card.onkeydown = function(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    };

    grid.appendChild(card);

    // Auto-select first item (flagged so the click handler doesn't track it)
    if (idx === 0 && !currentItem) {
      card.dataset.autoSelect = "true";
      card.click();
    }
  });
  
  renderPagination(totalPages);
}

// Render pagination
function renderPagination(totalPages) {
  if (!paginationEl) return;
  paginationEl.innerHTML = "";
  
  if (totalPages <= 1) return;
  
  let prev = document.createElement("button");
  prev.className = "page-btn";
  prev.textContent = "←";
  prev.disabled = currentPage === 1;
  prev.onclick = function() {
    if (currentPage > 1) {
      currentPage--;
      renderGrid();
    }
  };
  paginationEl.appendChild(prev);

  for (var i = 1; i <= totalPages; i++) {
    if (i <= 3 || i > totalPages - 2 || Math.abs(i - currentPage) <= 1) {
      (function(page) {
        let btn = document.createElement("button");
        btn.className = "page-btn" + (page === currentPage ? " active" : "");
        btn.textContent = page;
        btn.onclick = function() {
          currentPage = page;
          renderGrid();
        };
        paginationEl.appendChild(btn);
      })(i);
    } else if (i === 4 || i === totalPages - 2) {
      let dots = document.createElement("span");
      dots.textContent = "...";
      dots.style.padding = "0 8px";
      paginationEl.appendChild(dots);
    }
  }

  let next = document.createElement("button");
  next.className = "page-btn";
  next.textContent = "→";
  next.disabled = currentPage === totalPages;
  next.onclick = function() {
    if (currentPage < totalPages) {
      currentPage++;
      renderGrid();
    }
  };
  paginationEl.appendChild(next);
}

// Mark the badge as "seen" — opening / focusing the gallery means the user
// has reviewed any pending captures. The popup-side counterpart lives in
// popup.js. Together they keep the badge as a notification, not an odometer.
function markSeen() {
  try {
    chrome.storage.local.set({ igExporterLastSeenAt: Date.now() });
  } catch (e) { /* storage might be unavailable in some preview contexts */ }
}

// ---------------------------------------------------------------------------
// THE library entry point
// ---------------------------------------------------------------------------
// Every path that sets allMedia.images / allMedia.videos goes through here:
// initial storage load, storage.onChanged, imported JSON, imported URL lists,
// and clear-all. Nothing else may assign to allMedia directly.
//
// `persist` asks for the cleaned library to be written back, so unsafe legacy
// values are removed from chrome.storage.local permanently rather than merely
// filtered at render time. The write happens ONLY when sanitisation actually
// changed something — which is what stops a storage.onChanged feedback loop,
// because a second pass over already-clean data reports no change and writes
// nothing.
function adoptLibrary(data, opts) {
  opts = opts || {};
  let lib = globalThis.SBE_LIB;
  if (!lib || typeof lib.sanitizeLibrary !== "function") {
    // Fail closed: with no sanitiser we show nothing, rather than showing
    // unvalidated records.
    logDebug("SBE_LIB unavailable - refusing to load library");
    allMedia.images = [];
    allMedia.videos = [];
    setStatus("Internal error: sanitiser unavailable, library not loaded");
    return { images: [], videos: [], removedRecords: 0, removedFields: 0, changed: false };
  }

  let result = lib.sanitizeLibrary(data);
  allMedia.images = result.images;
  allMedia.videos = result.videos;

  if (result.changed) {
    logDebug("Sanitised library: removed " + result.removedRecords +
             " record(s), " + result.removedFields + " field(s)");
  }

  if (opts.persist && result.changed) {
    // Suppress our own echo so the listener does not re-render mid-write.
    _suppressStorageEcho = true;
    chrome.storage.local.set({
      igExporterData: { images: result.images, videos: result.videos },
      sbeLibrarySanitizedAt: Date.now()
    }, function () {
      _suppressStorageEcho = false;
      logDebug("Sanitised library persisted; unsafe legacy values removed from storage");
    });
  }

  if (opts.report && result.changed) {
    let msg = lib.describeRemoval(result);
    if (msg) setStatus(msg);
  }
  return result;
}

// Set while adoptLibrary writes its own sanitised output, so the
// storage.onChanged listener ignores the echo of that write.
var _suppressStorageEcho = false;

// Load data from storage
function loadData() {
  logDebug("Loading fresh data from storage...");
  markSeen();
  
  // Force fresh read from storage
  chrome.storage.local.get(null, function(result) {
    logDebug("Storage keys: " + Object.keys(result).join(", "));
    
    // Records written by 4.4.0 or earlier were never URL-validated, so this is
    // where they are cleaned AND the cleaned version is written back.
    if (result.igExporterData) {
      adoptLibrary(result.igExporterData, { persist: true, report: true });
      logDebug("Loaded: " + allMedia.images.length + " images, " + allMedia.videos.length + " videos");
    } else {
      logDebug("No data found in storage");
      adoptLibrary(null, {});
    }
    
    updateCounts();
    renderGrid();
  });
}

// Update button labels based on current tab.
// Note: Export is no longer tab-specific — it dumps both images and videos
// with full metadata, so its label stays constant. Copy is still per-tab
// (it's a quick URL-only clipboard action, not a backup).
function updateButtonLabels() {
  let label = currentTab === "images" ? "Images" : "Videos";
  let copyBtn = document.getElementById("copy");
  if (copyBtn) copyBtn.textContent = "Copy " + label;
}

// ----------------------------------------------------------------------------
// Export / import payload helpers — kept pure so tests can verify schema
// without spinning up a DOM. Schema is documented in the EXPORT_FORMAT_VERSION.
// ----------------------------------------------------------------------------
var EXPORT_FORMAT_VERSION = 1;

// Build a full-fidelity JSON-serializable payload from in-memory state.
// Preserves metadata, carouselSize, postUrl, scrapedAt — everything an item
// carried at capture time — so an export → import round-trip is lossless.
function buildExportPayload(images, videos, extensionVersion) {
  // Guarded on the way OUT as well as in. An export file is consumed by other
  // software and may be re-imported later, so it must not carry a URL we would
  // refuse to render.
  images = _exportSafeList(images);
  videos = _exportSafeList(videos);
  return {
    format: "saved-posts-backup-export",
    formatVersion: EXPORT_FORMAT_VERSION,
    extensionVersion: extensionVersion || null,
    exportedAt: new Date().toISOString(),
    images: Array.isArray(images) ? images.slice() : [],
    videos: Array.isArray(videos) ? videos.slice() : []
  };
}

// Strip any URL field that would not pass the sink guards, keeping the record
// itself. Used by both the JSON and the CSV export paths.
function _exportSafeList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(function (it) {
    if (!it || typeof it !== "object") return null;
    let out = {};
    for (let k in it) {
      if (Object.prototype.hasOwnProperty.call(it, k)) out[k] = it[k];
    }
    out.url = safeMediaUrl(it.url);
    out.thumbnail = safeMediaUrl(it.thumbnail);
    out.postUrl = safePostUrl(it.postUrl);
    if (!out.url && !out.thumbnail && !out.postUrl) return null;
    return out;
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Import sanitisation
// ---------------------------------------------------------------------------
// There used to be a second, import-only sanitiser here. It has been replaced
// by the single authoritative implementation in library-sanitize.js
// (globalThis.SBE_LIB), because having two meant an imported record and a
// legacy stored record could be treated with different strictness — and in
// 4.4.1 they were: imports were validated, stored legacy records were not.
//
// These remain as thin delegates so the import call sites and the tests keep a
// stable name. They add no logic of their own.

function sanitizeImportedItem(raw, fallbackType) {
  let lib = globalThis.SBE_LIB;
  if (!lib) return null;
  return lib.sanitizeRecord(raw, fallbackType, { records: 0, fields: 0 });
}

function sanitizeImportedList(list, fallbackType) {
  let lib = globalThis.SBE_LIB;
  if (!lib) return { items: [], dropped: Array.isArray(list) ? list.length : 0 };
  let tally = { records: 0, fields: 0 };
  let items = lib.sanitizeList(list, fallbackType, tally);
  return {
    items: items,
    dropped: (Array.isArray(list) ? list.length : 0) - items.length
  };
}

// Parse imported file text. Returns one of:
//   { format: 'json', images: [...], videos: [...] }  — full backup
//   { format: 'txt',  urls: [...] }                   — legacy URL list
// Throws on completely unparseable input.
function parseImportPayload(text) {
  let trimmed = (text || "").trim();
  if (!trimmed) {
    throw new Error("Empty file");
  }

  // JSON first: a valid backup starts with `{` and parses as our schema.
  if (trimmed.charAt(0) === "{") {
    let data;
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      throw new Error("Invalid JSON: " + e.message);
    }
    if (data && (Array.isArray(data.images) || Array.isArray(data.videos))) {
      return {
        format: "json",
        images: Array.isArray(data.images) ? data.images : [],
        videos: Array.isArray(data.videos) ? data.videos : []
      };
    }
    throw new Error("JSON file does not contain images/videos arrays");
  }

  // Otherwise treat as URL-per-line (the pre-v4.3.6 export format).
  let urls = trimmed.split(/\r?\n/)
    .map(function(l) { return l.trim(); })
    .filter(Boolean);
  if (!urls.length) {
    throw new Error("No URLs found in file");
  }
  return { format: "txt", urls: urls };
}

// ----------------------------------------------------------------------------
// Per-album ZIP download — for carousel posts, bundle all slides + a
// manifest.json into a single <shortcode>.zip. Uses JSZip (loaded via
// gallery.html before this file). Helpers below are pure so the manifest
// shape and filename rules can be tested without spinning up JSZip.
// ----------------------------------------------------------------------------

// Pick a file extension for a slide. Prefer the URL's extension when it's
// a known media type; otherwise infer from the slide's type field. Falls
// back to ".bin" so we never produce nameless files.
function _slideExtension(slide) {
  let url = (slide && (slide.url || slide.thumbnail)) || "";
  // Strip query string + signed-URL params before reading extension.
  let bare = String(url).split(/[?#]/)[0];
  let m = bare.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (m) {
    let ext = m[1].toLowerCase();
    if (/^(jpg|jpeg|png|gif|webp|mp4|mov|webm|heic|avif)$/.test(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  }
  if (slide && slide.type === "video") return "mp4";
  if (slide && slide.type === "image") return "jpg";
  return "bin";
}

// 1-indexed, zero-padded so files sort correctly in archive tools.
function albumFilename(slide, idx, totalSlides) {
  let n = idx + 1;
  let width = String(totalSlides).length;
  let padded = String(n);
  while (padded.length < width) padded = "0" + padded;
  return padded + "." + _slideExtension(slide);
}

// Build the manifest.json content for an album zip. Captures everything
// that's useful for re-importing or archival lookup later. Pure — takes
// the grouped item and returns a JSON-serializable object.
function buildAlbumManifest(item, extensionVersion) {
  if (!item) return null;
  let slides = Array.isArray(item._carouselSlides) ? item._carouselSlides : [item];
  let meta = item.metadata || {};
  return {
    format: "saved-posts-backup-export-album",
    formatVersion: 1,
    extensionVersion: extensionVersion || null,
    exportedAt: new Date().toISOString(),
    shortcode: item.postShortcode || null,
    postUrl: item.postUrl || null,
    owner: meta.owner || null,
    caption: meta.caption || null,
    takenAt: meta.takenAt || null,
    likeCount: typeof meta.likeCount === "number" ? meta.likeCount : null,
    hashtags: Array.isArray(meta.hashtags) ? meta.hashtags.slice() : [],
    slides: slides.map(function (s, i) {
      return {
        index: i,
        filename: albumFilename(s, i, slides.length),
        type: s.type || null,
        url: s.url || null,
        thumbnail: s.thumbnail || null,
        carouselIndex: typeof s.carouselIndex === "number" ? s.carouselIndex : null
      };
    })
  };
}

// Sanitize a string so it's safe as a filename prefix. Falls back to
// "album" so we never produce a nameless zip.
function _albumZipName(item) {
  let shortcode = (item && item.postShortcode) || "album";
  // Strip anything that's not safe on any common filesystem.
  return String(shortcode).replace(/[^a-zA-Z0-9._-]/g, "_") + ".zip";
}

// Sanitize a string for use as a folder name inside a zip. Empty / falsy
// input — and inputs that sanitize to nothing-but-underscores (all
// punctuation, no letters/digits) — collapse to "_unknown".
function _safeFolderName(s) {
  if (!s) return "_unknown";
  let clean = String(s).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!clean || /^_+$/.test(clean)) return "_unknown";
  return clean;
}

// Pull the owner key off an item — handles legacy items pre-v4.3 that
// lack metadata.owner. Returns the literal string '_unknown' (no leading
// underscore conflict with real Instagram usernames since usernames can't
// start with an underscore in URL form anyway).
function _ownerKey(item) {
  let owner = item && item.metadata && item.metadata.owner;
  return owner ? String(owner) : "_unknown";
}

// Group items by owner. Preserves first-seen order both for owner keys
// and for items within each group, so a sorted input stays meaningful.
// Returns an array of [owner, items[]] tuples (Map iteration order is
// equivalent but tuples test more easily).
function groupItemsByOwner(items) {
  if (!Array.isArray(items)) return [];
  let groups = Object.create(null);
  let order = [];
  for (var i = 0; i < items.length; i++) {
    let key = _ownerKey(items[i]);
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(items[i]);
  }
  return order.map(function (k) { return [k, groups[k]]; });
}

// Build the top-level manifest.json for a library zip. Lists each owner
// group with item counts and per-item paths, so anyone unpacking the zip
// can map files back to original posts without scraping filenames.
function buildLibraryManifest(items, ownerGroups, extensionVersion) {
  return {
    format: "saved-posts-backup-export-library",
    formatVersion: 1,
    extensionVersion: extensionVersion || null,
    exportedAt: new Date().toISOString(),
    totalItems: Array.isArray(items) ? items.length : 0,
    totalOwners: Array.isArray(ownerGroups) ? ownerGroups.length : 0,
    owners: (ownerGroups || []).map(function (g) {
      let owner = g[0], list = g[1];
      return {
        owner: owner === "_unknown" ? null : owner,
        folder: _safeFolderName(owner),
        itemCount: list.length,
        items: list.map(function (it) {
          let slideCount = (Array.isArray(it._carouselSlides) ? it._carouselSlides.length : 0) || 1;
          return {
            shortcode: it.postShortcode || null,
            postUrl: it.postUrl || null,
            type: it.type || null,
            slideCount: slideCount,
            caption: (it.metadata && it.metadata.caption) || null,
            takenAt: (it.metadata && it.metadata.takenAt) || null,
            likeCount: (it.metadata && typeof it.metadata.likeCount === "number")
              ? it.metadata.likeCount : null
          };
        })
      };
    })
  };
}

// Single-item filename inside its owner folder. Single-slide items get a
// flat name (<shortcode>.<ext>); albums get their own subfolder so all
// their slides stay together: <shortcode>/01.<ext>.
function _itemPathInOwnerFolder(item, slide, slideIdx, totalSlides, fallbackIdx) {
  let shortcode = item && item.postShortcode;
  if (!shortcode) {
    // Stable but unique fallback so two metadata-less items don't collide.
    shortcode = "item_" + String(fallbackIdx + 1).padStart(4, "0");
  } else {
    shortcode = String(shortcode).replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  let ext = _slideExtension(slide || item);
  if (totalSlides > 1) {
    // Album: nested folder.
    let w = String(totalSlides).length;
    let padded = String(slideIdx + 1);
    while (padded.length < w) padded = "0" + padded;
    return shortcode + "/" + padded + "." + ext;
  }
  // Single slide: flat file in the owner folder.
  return shortcode + "." + ext;
}

// Driver: download every item the user can currently see (post-filter,
// post-sort, current tab) as one big zip with per-owner folders inside.
// Confirms before starting if the count is large — even at 100 items the
// fetch + zip can take a minute and consume bandwidth.
async function downloadLibrary() {
  if (typeof JSZip === "undefined") {
    setStatus("Library download not available — JSZip failed to load");
    return;
  }
  let items = getFilteredItems();
  if (!items.length) {
    setStatus("Nothing to download — the current view is empty");
    return;
  }

  // Estimate total slide count (carousels contribute more than 1).
  let slideTotal = items.reduce(function (sum, it) {
    let n = (Array.isArray(it._carouselSlides) ? it._carouselSlides.length : 0) || 1;
    return sum + n;
  }, 0);

  if (slideTotal > 50) {
    let ok = confirm(
      "Download " + items.length + " items (" + slideTotal + " files) as a zip?\n" +
      "This may take a minute and use significant bandwidth."
    );
    if (!ok) return;
  }

  let extVersion = null;
  try { extVersion = chrome.runtime.getManifest().version; } catch (_) {}

  let groups = groupItemsByOwner(items);
  let manifest = buildLibraryManifest(items, groups, extVersion);
  setStatus("Preparing library (" + items.length + " items, " + slideTotal + " files)...", true);

  let zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  let done = 0;
  let failures = 0;
  for (var g = 0; g < groups.length; g++) {
    let ownerKey = groups[g][0];
    let ownerList = groups[g][1];
    let folder = _safeFolderName(ownerKey);
    for (var i = 0; i < ownerList.length; i++) {
      let it = ownerList[i];
      let slides = Array.isArray(it._carouselSlides) && it._carouselSlides.length
        ? it._carouselSlides : [it];
      for (var s = 0; s < slides.length; s++) {
        let slide = slides[s];
        let url = slide && (slide.url || slide.thumbnail);
        done++;
        if (!url) { failures++; continue; }
        if (!safeMediaUrl(url)) { failures++; continue; }
        setStatus("Fetching " + done + " / " + slideTotal + " — " + ownerKey, true);
        try {
          let res = await fetch(safeMediaUrl(url));
          if (!res.ok) throw new Error("HTTP " + res.status);
          let blob = await res.blob();
          let path = folder + "/" + _itemPathInOwnerFolder(it, slide, s, slides.length, i);
          zip.file(path, blob);
        } catch (e) {
          failures++;
          console.warn("[Gallery] Library slide fetch failed:", url, e.message);
        }
      }
    }
  }

  if (failures === slideTotal) {
    setStatus("Library download failed — every slide errored");
    return;
  }

  setStatus("Zipping " + slideTotal + " files...", true);
  try {
    let content = await zip.generateAsync({ type: "blob" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    let stamp = new Date().toISOString().slice(0, 10);
    a.download = "saved-posts-library-" + currentTab + "-" + stamp + ".zip";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    let msg = "Downloaded " + slideTotal + " files across " + groups.length + " owners";
    if (failures > 0) msg += " (" + failures + " failed)";
    setStatus(msg);
  } catch (e) {
    setStatus("Library zip failed: " + e.message);
  }
}

// Driver: fetch every slide, pack into a JSZip archive alongside a
// manifest.json, trigger download. Status updates surface progress so
// the user sees something happening for large albums.
async function downloadAlbum(item) {
  if (typeof JSZip === "undefined") {
    setStatus("Album download not available — JSZip failed to load");
    return;
  }
  let slides = Array.isArray(item && item._carouselSlides) ? item._carouselSlides : [];
  if (!slides.length) {
    setStatus("Nothing to download — album has no slides");
    return;
  }

  let extVersion = null;
  try { extVersion = chrome.runtime.getManifest().version; } catch (_) {}

  setStatus("Preparing album (" + slides.length + " slides)...", true);

  let zip = new JSZip();
  let manifest = buildAlbumManifest(item, extVersion);
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  let failures = 0;
  for (var i = 0; i < slides.length; i++) {
    let slide = slides[i];
    let url = slide && (slide.url || slide.thumbnail);
    if (!safeMediaUrl(url)) { failures++; continue; }
    setStatus("Fetching " + (i + 1) + " / " + slides.length + "...", true);
    try {
      let res = await fetch(safeMediaUrl(url));
      if (!res.ok) throw new Error("HTTP " + res.status);
      let blob = await res.blob();
      zip.file(albumFilename(slide, i, slides.length), blob);
    } catch (e) {
      failures++;
      console.warn("[Gallery] Album slide fetch failed:", url, e.message);
    }
  }

  if (failures === slides.length) {
    setStatus("Album download failed — all slides errored");
    return;
  }

  setStatus("Zipping " + slides.length + " slides...", true);
  try {
    let content = await zip.generateAsync({ type: "blob" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = _albumZipName(item);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    let msg = "Downloaded " + slides.length + " slides";
    if (failures > 0) msg += " (" + failures + " failed)";
    setStatus(msg);
  } catch (e) {
    setStatus("Album zip failed: " + e.message);
  }
}

// ----------------------------------------------------------------------------
// CSV export — RFC 4180 compliant. The metadata.caption field can carry
// newlines, commas, and quotes; we escape carefully so the file opens cleanly
// in Excel / Numbers / Google Sheets.
// ----------------------------------------------------------------------------

var CSV_COLUMNS = [
  "type", "url", "thumbnail",
  "postUrl", "postShortcode",
  "carouselIndex", "carouselSize",
  "owner", "caption", "takenAt", "likeCount", "hashtags",
  "scrapedAt"
];

// RFC 4180: a field that contains a comma, quote, CR, or LF must be wrapped
// in double quotes; embedded double quotes inside a wrapped field are
// escaped by doubling them. Everything else passes through.
function csvEscape(val) {
  if (val === null || val === undefined) return "";
  let s = String(val);
  if (s === "") return "";
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Pure: given a flat list of items, produce a CSV string. Items lacking
// metadata fields write empty cells, not "null" or "undefined".
function buildCsv(items) {
  items = _exportSafeList(items);
  let lines = [CSV_COLUMNS.join(",")];
  if (!Array.isArray(items)) return lines.join("\r\n");
  for (var i = 0; i < items.length; i++) {
    let it = items[i] || {};
    let meta = it.metadata || {};
    let tags = Array.isArray(meta.hashtags) ? meta.hashtags.join(" ") : "";
    lines.push([
      csvEscape(it.type),
      csvEscape(it.url),
      csvEscape(it.thumbnail),
      csvEscape(it.postUrl),
      csvEscape(it.postShortcode),
      csvEscape(typeof it.carouselIndex === "number" ? it.carouselIndex : ""),
      csvEscape(typeof it.carouselSize === "number" ? it.carouselSize : ""),
      csvEscape(meta.owner),
      csvEscape(meta.caption),
      csvEscape(meta.takenAt),
      csvEscape(typeof meta.likeCount === "number" ? meta.likeCount : ""),
      csvEscape(tags),
      csvEscape(it.scrapedAt)
    ].join(","));
  }
  return lines.join("\r\n");
}

// Tab switching
document.querySelectorAll(".tab").forEach(function(tab) {
  tab.onclick = function() {
    document.querySelectorAll(".tab").forEach(function(t) { t.classList.remove("active"); });
    tab.classList.add("active");
    currentTab = tab.getAttribute("data-tab");
    currentPage = 1;
    currentItem = null;
    selectedCard = null;
    // Tab switch wipes the grid — instant close is the right feel.
    collapseCarousel({ instant: true });
    renderGrid();
    updateButtonLabels();
    
    // Hide slideshow controls for videos tab
    let slideshowControls = document.getElementById("slideshow-controls");
    if (slideshowControls) {
      slideshowControls.style.display = currentTab === "videos" ? "none" : "flex";
    }
    
  };
});

// Set initial button labels
updateButtonLabels();

// Button handlers
document.getElementById("download-current")?.addEventListener("click", async function() {
  if (!currentItem) { setStatus("Select an item first"); return; }
  // Media-only: a permalink must never be fetched as if it were media.
  let url = safeMediaUrl(getMediaUrl(currentItem));
  let isVideo = currentTab === "videos";

  if (!url) {
    setStatus("This item has no downloadable media URL on the allowlist");
    return;
  }

  {
    if (isVideo) {
      // Videos are usually served without permissive CORS headers, so a blob
      // fetch fails; open in a new tab so the browser can save it directly.
      setStatus("Opening video - right-click to save");
      window.open(safeMediaUrl(url), '_blank', 'noopener,noreferrer');
    } else {
      // Images can be fetched as blob
      setStatus("Downloading...");
      try {
        let response = await fetch(safeMediaUrl(url));
        let blob = await response.blob();
        let blobUrl = URL.createObjectURL(blob);
        
        let a = document.createElement("a");
        a.href = blobUrl;
        a.download = "saved-post_" + Date.now() + ".jpg";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        
        setStatus("Download complete!");
      } catch (err) {
        console.error("Download failed:", err);
        setStatus("Download failed - try right-click > Save As");
      }
    }
  }
});

document.getElementById("copy")?.addEventListener("click", function() {
  // Guarded again on the way OUT: an unsafe URL must not be handed to another
  // application via the clipboard.
  let all = getCurrentItems();
  let skipped = 0;
  navigator.clipboard.writeText(
    all.map(function (it) { return safeExportUrl(getUrl(it)); })
       .filter(function (u) { if (!u) { skipped++; } return !!u; })
       .join("\n")
  ).then(function() {
    let urls = all.map(function (it) { return safeExportUrl(getUrl(it)); }).filter(Boolean);
    setStatus("Copied " + urls.length + " URLs" +
      (skipped ? " (" + skipped + " skipped: not allowlisted)" : ""));
    
  });
});

document.getElementById("export")?.addEventListener("click", function() {
  let extVersion = null;
  try { extVersion = chrome.runtime.getManifest().version; } catch (_) {}
  let payload = buildExportPayload(allMedia.images, allMedia.videos, extVersion);
  let json = JSON.stringify(payload, null, 2);
  let blob = new Blob([json], { type: "application/json" });
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  // Date stamp so successive exports don't overwrite each other.
  let stamp = new Date().toISOString().slice(0, 10);
  a.download = "saved-posts-export-" + stamp + ".json";
  a.click();

  let total = payload.images.length + payload.videos.length;
  setStatus("Exported " + total + " items (" +
    payload.images.length + " images, " + payload.videos.length + " videos)");

});

document.getElementById("clear")?.addEventListener("click", function() {
  // Destructive + irreversible — confirm first.
  if (!confirm("Delete all captured images and videos? This cannot be undone.")) {
    return;
  }


  adoptLibrary(null, {});

  // Stop any in-flight playback/slideshow and unwire the viewer from the
  // about-to-be-deleted item before storage commits.
  resetViewer();
  // A lingering search query against empty data shows "Showing 0 of 0" —
  // reset it so the user sees a clean "nothing captured yet" state. Sort
  // resets too since "Newest post" on empty data is pointless.
  setSearchQuery("");
  setSortBy("default");

  chrome.storage.local.set({
    igExporterData: { images: [], videos: [] }
  }, function() {
    updateCounts();
    renderGrid();
    setStatus("Cleared all data");
    logDebug("Data cleared");
  });
});

document.getElementById("download-zip")?.addEventListener("click", function () {
  downloadLibrary();
});

document.getElementById("export-csv")?.addEventListener("click", function () {
  // CSV is per-tab (one row per item) so the user gets exactly what they're
  // looking at — flat structure that drops cleanly into Excel/Sheets.
  let items = currentTab === "videos" ? allMedia.videos : allMedia.images;
  let csv = buildCsv(items);
  // BOM so Excel correctly detects UTF-8 (otherwise it mangles accented owners).
  let blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  let stamp = new Date().toISOString().slice(0, 10);
  a.download = "saved-posts-" + currentTab + "-" + stamp + ".csv";
  a.click();

  setStatus("Exported " + items.length + " rows to CSV");
});

document.getElementById("import")?.addEventListener("click", function() {
  document.getElementById("file-input")?.click();
});

// ---------------------------------------------------------------------------
// Import application path
// ---------------------------------------------------------------------------
// Extracted from the file-input handler so it can be tested end to end. It was
// NOT testable before, and that is precisely how a ReferenceError shipped
// through 368 passing tests: `parseImportPayload` and `sanitizeImportedList`
// were both covered, but nothing executed the code that joins them, so a
// reference to two variables that no longer existed went unnoticed. The bug
// threw after adoptLibrary() and before chrome.storage.local.set(), leaving the
// library updated in memory and never persisted.
//
// Returns { ok, status, accepted, rejected, format } so a test can assert on
// the outcome instead of scraping the DOM.
function applyParsedImport(parsed, deps) {
  deps = deps || {};
  var adopt = deps.adoptLibrary || adoptLibrary;
  var tab = deps.currentTab || currentTab;

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, status: "Import failed: nothing to import",
             accepted: 0, rejected: 0, format: null };
  }

  if (parsed.format === "json") {
    // Full-fidelity backup: replaces both tabs. Routed through the same
    // authoritative sanitiser as a storage load.
    var before = (Array.isArray(parsed.images) ? parsed.images.length : 0) +
                 (Array.isArray(parsed.videos) ? parsed.videos.length : 0);
    var res = adopt({ images: parsed.images, videos: parsed.videos }, {});
    var accepted = res.images.length + res.videos.length;
    var rejected = before - accepted;
    return {
      ok: true,
      format: "json",
      accepted: accepted,
      rejected: rejected,
      images: res.images.length,
      videos: res.videos.length,
      status: "Imported " + accepted + " items (" +
        res.images.length + " images, " + res.videos.length + " videos)" +
        (rejected ? " \u2014 " + rejected + " rejected" : "")
    };
  }

  // Legacy URL list: drops into the current tab only, no metadata.
  var intoImages = tab === "images";
  var fallbackType = intoImages ? "image" : "video";
  var raw = (parsed.urls || []).map(function (url) {
    return { type: fallbackType, url: url, thumbnail: url };
  });
  var out = adopt(
    intoImages ? { images: raw, videos: allMedia.videos }
               : { images: allMedia.images, videos: raw }, {});
  var kept = intoImages ? out.images.length : out.videos.length;
  var dropped = raw.length - kept;
  return {
    ok: true,
    format: "txt",
    accepted: kept,
    rejected: dropped,
    images: out.images.length,
    videos: out.videos.length,
    status: "Imported " + kept + " URLs (legacy format, metadata not included)" +
      (dropped ? " \u2014 " + dropped + " rejected" : "")
  };
}

// Persist whatever the library currently holds. Separate function so the
// import path and the tests agree on exactly what gets written.
function persistCurrentLibrary() {
  chrome.storage.local.set({
    igExporterData: { images: allMedia.images, videos: allMedia.videos }
  });
}

// The whole import flow, from raw file text to persisted library. Anything that
// throws here is reported to the user and does NOT leave a half-applied state.
function runImport(text, fileInput) {
  var parsed;
  try {
    parsed = parseImportPayload(text);
  } catch (e) {
    setStatus("Import failed: " + e.message);
    if (fileInput) fileInput.value = "";
    return { ok: false, status: "Import failed: " + e.message };
  }

  var result;
  try {
    result = applyParsedImport(parsed);
    persistCurrentLibrary();
    updateCounts();
    renderGrid();
  } catch (e) {
    // Belt and braces: an unexpected throw must not silently skip the
    // persist/render steps and leave the UI disagreeing with storage.
    console.error("[Gallery] Import failed after parsing:", e);
    setStatus("Import failed while applying: " + e.message);
    if (fileInput) fileInput.value = "";
    return { ok: false, status: "Import failed while applying: " + e.message };
  }

  setStatus(result.status);
  if (fileInput) fileInput.value = "";  // allow re-importing the same file
  return result;
}

document.getElementById("file-input")?.addEventListener("change", function() {
  let file = this.files[0];
  if (!file) return;
  let fileInput = this;
  let reader = new FileReader();
  reader.onload = function() {
    runImport(reader.result, fileInput);
  };
  reader.readAsText(file);
});

document.getElementById("donate")?.addEventListener("click", function() {
  window.open("https://www.patreon.com/join/THYProduction", "_blank", "noopener,noreferrer");
});


// Listen for storage changes
chrome.storage.onChanged.addListener(function(changes, area) {
  if (area !== "local") return;
  
  logDebug("Storage changed: " + Object.keys(changes).join(", "));
  
  if (changes.igExporterData && changes.igExporterData.newValue) {
    if (_suppressStorageEcho) {
      logDebug("Ignoring echo of our own sanitised write");
      return;
    }
    // A capture in progress writes here too, so this payload gets exactly the
    // same treatment as the initial load.
    adoptLibrary(changes.igExporterData.newValue, { persist: true });
    markSeen();
    updateCounts();
    renderGrid();
  }
});

// Set version
if (versionEl) {
  try {
    versionEl.textContent = "v" + chrome.runtime.getManifest().version;
  } catch (e) {}
}

// Sort dropdown wiring.
(function wireSort() {
  let sel = document.getElementById("sort-select");
  if (!sel) return;
  sel.addEventListener("change", function () {
    setSortBy(sel.value);
  });
})();

// Search input wiring — debounced live filter on caption / owner / hashtags.
(function wireSearch() {
  let input = document.getElementById("search-input");
  let clearBtn = document.getElementById("search-clear");
  if (!input) return;

  let debounceTimer = null;
  input.addEventListener("input", function () {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      setSearchQuery(input.value);
    }, 150);
  });
  // Esc clears immediately (no debounce) without leaving the input
  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && input.value) {
      e.stopPropagation();
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      setSearchQuery("");
      input.focus();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      setSearchQuery("");
      input.focus();
    });
  }
})();

// Initialize
loadData();

// Reload data when tab becomes visible (user switches back to gallery)
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    logDebug("Tab visible - reloading data...");
    loadData();
  }
});

// Also reload when window gains focus
window.addEventListener('focus', function() {
  logDebug("Window focused - reloading data...");
  loadData();
});


// ============================================
// FULLSCREEN & SLIDESHOW
// ============================================

var fullscreenOverlay = document.getElementById("fullscreen-overlay");
var fullscreenImage = document.getElementById("fullscreen-image");
var fullscreenVideo = document.getElementById("fullscreen-video");
var fullscreenClose = document.getElementById("fullscreen-close");
var fullscreenPrev = document.getElementById("fullscreen-prev");
var fullscreenNext = document.getElementById("fullscreen-next");
var fullscreenCounter = document.getElementById("fullscreen-counter");
var fullscreenBtn = document.getElementById("fullscreen-btn");
var slideshowInterval = null;
var currentFullscreenIndex = 0;

// Get items for fullscreen navigation — a flat list of every individual slide
// across every post, in capture order. A carousel post contributes all its
// slides; a single post contributes itself. After the last slide of post N,
// Next advances into the first slide of post N+1 (instead of looping inside
// the same carousel, which was the v4.3 behavior).
function getFullscreenItems() {
  let grouped = getCurrentItems();
  let flat = [];
  grouped.forEach(function(item) {
    if (Array.isArray(item._carouselSlides)) {
      // _carouselSlides[0] is the cover; the array already holds every slide
      // in carouselIndex order.
      for (var i = 0; i < item._carouselSlides.length; i++) {
        flat.push(item._carouselSlides[i]);
      }
    } else {
      flat.push(item);
    }
  });
  return flat;
}

// Update fullscreen counter
function updateFullscreenCounter() {
  let items = getFullscreenItems();
  if (fullscreenCounter) {
    fullscreenCounter.textContent = (currentFullscreenIndex + 1) + " / " + items.length;
  }
}

// Show item in fullscreen
function showFullscreenItem(index) {
  let items = getFullscreenItems();
  if (index < 0) index = items.length - 1;
  if (index >= items.length) index = 0;
  currentFullscreenIndex = index;
  
  let item = items[index];
  let url = getUrl(item);
  // Only check item.type for video detection - don't check URL patterns as they're unreliable
  let isVideo = item && item.type === 'video';
  
  // Stop any playing video
  if (fullscreenVideo) {
    fullscreenVideo.pause();
    fullscreenVideo.src = '';
  }
  
  // Show/hide slideshow buttons based on content type
  let btn2 = document.getElementById("fs-slide-2");
  let btn3 = document.getElementById("fs-slide-3");
  let btn5 = document.getElementById("fs-slide-5");
  let stopBtn = document.getElementById("fs-slide-stop");
  if (isVideo) {
    // Hide slideshow buttons for videos
    if (btn2) btn2.style.display = 'none';
    if (btn3) btn3.style.display = 'none';
    if (btn5) btn5.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'none';
  } else {
    // Show slideshow buttons for images
    if (btn2) btn2.style.display = 'inline-block';
    if (btn3) btn3.style.display = 'inline-block';
    if (btn5) btn5.style.display = 'inline-block';
  }
  
  if (isVideo) {
    // Show video, hide image
    if (fullscreenImage) fullscreenImage.style.display = 'none';
    if (fullscreenVideo) {
      fullscreenVideo.style.display = 'block';
      fullscreenVideo.src = safeMediaUrl(getMediaUrl(item)) || safeMediaUrl(url) || '';
      fullscreenVideo.load();
    }
  } else {
    // Show image, hide video
    if (fullscreenVideo) fullscreenVideo.style.display = 'none';
    if (fullscreenImage) {
      fullscreenImage.style.display = 'block';
      fullscreenImage.src = safeMediaUrl(url) || '';
    }
  }
  updateFullscreenCounter();
}

// Open fullscreen
function openFullscreen() {
  let items = getFullscreenItems();
  if (items.length === 0) return;
  
  // Find current item index
  if (currentItem) {
    let url = getUrl(currentItem);
    for (var i = 0; i < items.length; i++) {
      if (getUrl(items[i]) === url) {
        currentFullscreenIndex = i;
        break;
      }
    }
  } else {
    currentFullscreenIndex = 0;
  }
  
  showFullscreenItem(currentFullscreenIndex);
  if (fullscreenOverlay) {
    fullscreenOverlay.classList.add("visible");
  }
  
}

// Close fullscreen
function closeFullscreen() {
  if (fullscreenOverlay) {
    fullscreenOverlay.classList.remove("visible");
  }
  // Stop video playback
  if (fullscreenVideo) {
    fullscreenVideo.pause();
    fullscreenVideo.src = '';
  }
  stopSlideshow();
}

// Next/Prev in fullscreen. Both buttons and keyboard arrows funnel here so
// the single event covers both interaction modes.
function fullscreenNextItem(source) {
  showFullscreenItem(currentFullscreenIndex + 1);
}

function fullscreenPrevItem(source) {
  showFullscreenItem(currentFullscreenIndex - 1);
}

// Slideshow controls. Speed buttons (2s / 3s / 5s) stay visible at all times
// (when an image is showing); the active one gets `.active` so the user can
// see which speed is in effect and switch on the fly. The Stop button only
// appears while a slideshow is running.
var SLIDESHOW_SPEED_IDS = ["fs-slide-2", "fs-slide-3", "fs-slide-5"];

function clearSlideshowActiveState() {
  for (var i = 0; i < SLIDESHOW_SPEED_IDS.length; i++) {
    let b = document.getElementById(SLIDESHOW_SPEED_IDS[i]);
    if (b) b.classList.remove("active");
  }
}

function setSlideshowActiveSpeed(intervalMs) {
  clearSlideshowActiveState();
  for (var i = 0; i < SLIDESHOW_SPEED_IDS.length; i++) {
    let b = document.getElementById(SLIDESHOW_SPEED_IDS[i]);
    if (!b) continue;
    if (parseInt(b.getAttribute("data-interval"), 10) === intervalMs) {
      b.classList.add("active");
    }
  }
}

function startSlideshow(intervalMs) {
  stopSlideshow();
  slideshowInterval = setInterval(function() {
    fullscreenNextItem('slideshow');
  }, intervalMs);

  // Show stop button; mark the chosen speed as active.
  let stopBtn = document.getElementById("fs-slide-stop");
  if (stopBtn) stopBtn.style.display = "inline-block";
  setSlideshowActiveSpeed(intervalMs);

}

function stopSlideshow() {
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
  let stopBtn = document.getElementById("fs-slide-stop");
  if (stopBtn) stopBtn.style.display = "none";
  clearSlideshowActiveState();
}

// Event listeners for fullscreen
if (fullscreenBtn) {
  fullscreenBtn.addEventListener("click", openFullscreen);
}

if (imageViewer) {
  imageViewer.addEventListener("click", openFullscreen);
}

if (fullscreenClose) {
  fullscreenClose.addEventListener("click", closeFullscreen);
}

if (fullscreenPrev) {
  fullscreenPrev.addEventListener("click", fullscreenPrevItem);
}

if (fullscreenNext) {
  fullscreenNext.addEventListener("click", fullscreenNextItem);
}

// Auto-play next video when current one ends
if (fullscreenVideo) {
  fullscreenVideo.addEventListener("ended", function() {
    fullscreenNextItem('video_ended');
  });
}

// Slideshow buttons in fullscreen
document.getElementById("fs-slide-2")?.addEventListener("click", function() {
  startSlideshow(2000);
});

document.getElementById("fs-slide-3")?.addEventListener("click", function() {
  startSlideshow(3000);
});

document.getElementById("fs-slide-5")?.addEventListener("click", function() {
  startSlideshow(5000);
});

document.getElementById("fs-slide-stop")?.addEventListener("click", stopSlideshow);

// Keyboard navigation in fullscreen
document.addEventListener("keydown", function(e) {
  // Esc collapses an expanded carousel (when fullscreen isn't already eating it)
  if (e.key === "Escape" &&
      (!fullscreenOverlay || !fullscreenOverlay.classList.contains("visible")) &&
      expandedCard) {
    collapseCarousel();
    return;
  }
  if (!fullscreenOverlay || !fullscreenOverlay.classList.contains("visible")) return;

  if (e.key === "Escape") {
    closeFullscreen();
  } else if (e.key === "ArrowRight" || e.key === " ") {
    fullscreenNextItem('key');
  } else if (e.key === "ArrowLeft") {
    fullscreenPrevItem('key');
  }
});

// Click outside any expanded card → collapse. Use the grid as the scope so we
// don't collapse on clicks in the viewer panel or actions.
document.getElementById("grid")?.addEventListener("click", function(e) {
  if (!expandedCard) return;
  if (!expandedCard.contains(e.target)) {
    collapseCarousel();
  }
});

// Close fullscreen on overlay click (but not on image)
if (fullscreenOverlay) {
  fullscreenOverlay.addEventListener("click", function(e) {
    if (e.target === fullscreenOverlay) {
      closeFullscreen();
    }
  });
}

// Non-fullscreen slideshow controls
document.querySelectorAll(".slideshow-btn[data-interval]").forEach(function(btn) {
  btn.addEventListener("click", function() {
    let interval = parseInt(btn.getAttribute("data-interval"));
    if (interval) {
      openFullscreen();
      setTimeout(function() {
        startSlideshow(interval);
      }, 300);
    }
  });
});
