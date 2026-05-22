/**
 * Instagram Media Gallery - Simplified & Reliable
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

// Debug
function logDebug(msg) {
  console.log('[Gallery]', msg);
}

// Check if URL is a playable video URL (CDN URL, not Instagram post URL)
function isPlayableVideoUrl(url) {
  if (!url) return false;
  // Must be CDN URL with video indicators
  return (url.includes('cdninstagram') || url.includes('fbcdn')) && 
         (url.includes('.mp4') || url.includes('/v/') || url.includes('video'));
}


// Helper functions
function getUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.url || item.thumbnail || item.postUrl || null;
}

function getThumbnail(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.thumbnail || item.url || null;
}

function getPostUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return null;
  return item.postUrl || null;
}

// Send a GA4 'item_viewed' event when a user clicks a card.
// `post_url` is the openable Instagram permalink (stable, ~36 chars) and is
// the field to aggregate on. GA4 truncates custom param values at ~100 chars,
// so the full signed CDN URL won't fit — we still send `media_path` (pathname
// only) as a stable asset-level identifier for cases without a shortcode.
function trackItemView(item) {
  if (!item || !window.Analytics) return;
  var url = getUrl(item);
  if (!url) return;
  var pathname = url;
  try { pathname = new URL(url).pathname; } catch (e) { /* leave as-is */ }
  var postUrl = item.postShortcode
    ? 'https://www.instagram.com/p/' + item.postShortcode + '/'
    : (item.postUrl || null);
  Analytics.trackFeature('item_viewed', {
    media_type: currentTab === 'videos' ? 'video' : 'image',
    post_url: postUrl,
    post_shortcode: item.postShortcode || null,
    media_path: pathname,
    carousel_index: typeof item.carouselIndex === 'number' ? item.carouselIndex : null,
    carousel_size: item.carouselSize || 1
  });
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}

function setProgress(val) {
  if (progressBar) progressBar.style.width = Math.max(0, Math.min(100, val)) + "%";
}

// Escape user-supplied strings before injecting into innerHTML.
// Captions and usernames come from Instagram and may contain HTML special chars.
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
  var items = currentTab === "images" ? allMedia.images : allMedia.videos;
  // Items inside the same post dedupe by (shortcode, carouselIndex) so that a
  // slide URL matching the cover URL doesn't drop the slide. Items without a
  // shortcode (legacy data captured pre-v4.3) dedupe by URL.
  var seenWithinPost = {};
  var seenUrl = {};
  var groupOrder = [];
  var groupMap = {};

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var url = getUrl(item);
    if (!url) continue;

    if (item && item.postShortcode) {
      var idx = (item.carouselIndex == null) ? 'cover' : item.carouselIndex;
      var slotKey = item.postShortcode + ':' + idx;
      if (seenWithinPost[slotKey]) continue;
      seenWithinPost[slotKey] = true;
    } else {
      if (seenUrl[url]) continue;
      seenUrl[url] = true;
    }

    var key = (item && item.postShortcode) ? ("post:" + item.postShortcode) : ("item:" + url);
    if (!groupMap[key]) {
      groupMap[key] = [];
      groupOrder.push(key);
    }
    groupMap[key].push(item);
  }

  return groupOrder.map(function(key) {
    var slides = groupMap[key];
    if (slides.length === 1) return slides[0];
    var sorted = slides.slice().sort(function(a, b) {
      var ai = (a.carouselIndex == null) ? 0 : a.carouselIndex;
      var bi = (b.carouselIndex == null) ? 0 : b.carouselIndex;
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
  var meta = (item && item.metadata) || null;
  var owner = (meta && meta.owner) ? String(meta.owner).toLowerCase() : "";
  var caption = (meta && meta.caption) ? String(meta.caption).toLowerCase() : "";
  var hashtags = (meta && Array.isArray(meta.hashtags))
    ? meta.hashtags.map(function (t) { return String(t).toLowerCase(); })
    : [];
  return { owner: owner, caption: caption, hashtags: hashtags };
}

function _tokenMatches(token, hay) {
  if (token.charAt(0) === "@") {
    var name = token.slice(1);
    return name.length > 0 && hay.owner.indexOf(name) !== -1;
  }
  if (token.charAt(0) === "#") {
    var tag = token.slice(1);
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
  var tokens = _searchTokenize(query);
  if (!tokens.length) return true;
  // Items without metadata can't match any non-empty query.
  if (!item || !item.metadata) return false;
  var hay = _itemSearchHaystack(item);
  for (var i = 0; i < tokens.length; i++) {
    if (!_tokenMatches(tokens[i], hay)) return false;
  }
  return true;
}

// Filter the grouped current-tab items by the active search query.
// Carousel grouping happens upstream (getCurrentItems), so each filtered
// entry already represents an album cover when applicable.
function getFilteredItems() {
  var items = getCurrentItems();
  if (!searchQuery) return items;
  return items.filter(function (it) { return matchesQuery(it, searchQuery); });
}

// Centralized setter. Resets to page 1 (otherwise we could be stuck on a
// page beyond the filtered total), updates the input/clear/meta UI, and
// re-renders the grid.
function setSearchQuery(value) {
  var next = String(value || "");
  if (next === searchQuery) return;
  searchQuery = next;
  currentPage = 1;
  // Keep the input in sync if the change came from somewhere other than typing
  var input = document.getElementById("search-input");
  if (input && input.value !== next) input.value = next;
  var clearBtn = document.getElementById("search-clear");
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
  if (window.Analytics && next) {
    Analytics.trackFeature('gallery_search', {
      query_length: next.length,
      has_token_modifier: /[@#]/.test(next) ? 1 : 0
    });
  }
}

// "Showing N of M results for '...'" row beneath the toolbar. Hidden when
// the query is empty.
function renderSearchMeta(filtered, total) {
  var meta = document.getElementById("search-meta");
  if (!meta) return;
  if (!searchQuery) {
    meta.hidden = true;
    meta.innerHTML = "";
    return;
  }
  meta.hidden = false;
  var label = (filtered === total)
    ? '<strong>' + filtered + '</strong> ' + (filtered === 1 ? 'result' : 'results') +
      ' for <strong>' + escapeHtml(searchQuery) + '</strong>'
    : 'Showing <strong>' + filtered + '</strong> of <strong>' + total +
      '</strong> ' + (total === 1 ? 'item' : 'items') +
      ' for <strong>' + escapeHtml(searchQuery) + '</strong>';
  meta.innerHTML =
    '<span>' + label + '</span>' +
    '<button class="search-meta-clear" type="button">Clear</button>';
  var clear = meta.querySelector(".search-meta-clear");
  if (clear) clear.onclick = function () { setSearchQuery(""); };
}

// Render the metadata block under the viewer (caption, owner, date, album size).
// No-op when the item has no metadata (legacy items pre-v4.3).
function renderViewerMeta(item) {
  var el = document.getElementById("viewer-meta");
  if (!el) return;

  var meta = item && item.metadata;
  var hasAlbum = item && item.carouselSize && item.carouselSize > 1;

  if (!meta && !hasAlbum) {
    el.classList.remove("visible");
    el.innerHTML = "";
    return;
  }

  var headParts = [];
  if (meta && meta.owner) headParts.push('<span class="vm-owner">@' + escapeHtml(meta.owner) + '</span>');
  if (meta && meta.takenAt) {
    var d = new Date(meta.takenAt);
    if (!isNaN(d.getTime())) headParts.push('<span class="vm-date">' + d.toLocaleDateString() + '</span>');
  }
  if (hasAlbum) {
    headParts.push('<span class="vm-album">📷 ' + item.carouselSize + ' slides</span>');
  }

  var headHtml = headParts.length ? '<div class="vm-head">' + headParts.join(' · ') + '</div>' : '';
  var captionHtml = '';
  if (meta && meta.caption) {
    var c = meta.caption.length > 280 ? meta.caption.slice(0, 280) + '…' : meta.caption;
    captionHtml = '<div class="vm-caption">' + escapeHtml(c) + '</div>';
  }

  el.innerHTML = headHtml + captionHtml;
  el.classList.add("visible");
}

// Update counts
function updateCounts() {
  var images = allMedia.images.length;
  var videos = allMedia.videos.length;
  if (imageCountEl) imageCountEl.textContent = images;
  if (videoCountEl) videoCountEl.textContent = videos;
  
  // Count how many videos have playable URLs
  var playableVideos = allMedia.videos.filter(function(v) {
    return isPlayableVideoUrl(getUrl(v));
  }).length;
  
  logDebug("Counts: " + images + " images, " + videos + " videos (" + playableVideos + " playable)");
  
  // Show first video details for debugging
  if (allMedia.videos.length > 0) {
    var v = allMedia.videos[0];
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
  var strip = document.createElement("div");
  strip.className = "carousel-strip";
  strip.setAttribute("role", "list");
  strip.setAttribute("aria-label", "Album slides");

  for (var i = 0; i < slides.length; i++) {
    var slide = slides[i];
    var thumbUrl = (slide && (slide.thumbnail || slide.url)) || "";
    var slideEl = document.createElement("button");
    slideEl.className = "carousel-strip-slide";
    slideEl.setAttribute("role", "listitem");
    slideEl.setAttribute("aria-label", "Slide " + (i + 1) + " of " + slides.length);
    slideEl.setAttribute("data-slide-index", i);
    // Stagger index for the keyframe delay (capped so a 50-slide album
    // doesn't take 2.5 seconds to settle).
    if (slideEl.style) slideEl.style.setProperty("--i", String(Math.min(i, 10)));
    var img = document.createElement("img");
    img.src = thumbUrl;
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
  var instant = !!(opts && opts.instant);
  var card = expandedCard;
  // Free the slot immediately so a re-expand on the same card during the
  // close animation can race in without false "already expanded" guards.
  expandedCard = null;

  var drawer = card.querySelector(".carousel-drawer:not(.is-closing)");

  function finishClose() {
    if (drawer && drawer.parentNode) drawer.remove();
    // Belt-and-braces: drop any stray bare strip too (defensive).
    var stray = card.querySelector(".carousel-strip");
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
  var done = false;
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

  var slides = getCarouselSlides(item);
  if (!slides.length) return;

  // Build the drawer: header with album count + close, then the strip.
  var drawer = document.createElement("div");
  drawer.className = "carousel-drawer";

  var header = document.createElement("div");
  header.className = "carousel-drawer-header";
  header.innerHTML =
    '<span class="carousel-drawer-title">' +
      '<strong>' + slides.length + '</strong> slides' +
    '</span>';

  var closeBtn = document.createElement("button");
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

  var strip = buildCarouselStrip(slides);
  drawer.appendChild(strip);

  // Clicking a slide thumb previews it in the viewer.
  drawer.addEventListener("click", function (e) {
    var btn = e.target.closest(".carousel-strip-slide");
    if (!btn) return;
    e.stopPropagation();
    var idx = parseInt(btn.getAttribute("data-slide-index"), 10);
    var slide = slides[idx];
    if (!slide) return;
    if (currentTab === "videos") {
      showVideo(slide);
    } else {
      showImage(slide);
    }
    var prev = strip.querySelector(".carousel-strip-slide.active");
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
  var meta = document.getElementById("viewer-meta");
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
  var url = getUrl(item);
  if (!url) return;

  if (player) { player.pause(); player.style.display = "none"; }
  if (viewerPlaceholder) viewerPlaceholder.style.display = "none";
  if (imageViewer) {
    imageViewer.style.display = "block";
    imageViewer.src = url;
  }
  currentItem = item;
  renderViewerMeta(item);
}

// Show video in viewer
function showVideo(item) {
  var url = getUrl(item);
  var postUrl = getPostUrl(item);
  var thumb = getThumbnail(item);
  
  logDebug("Video item: url=" + (url ? url.substring(0, 60) + "..." : "null") + ", postUrl=" + (postUrl || "null"));
  
  if (imageViewer) imageViewer.style.display = "none";
  if (player) { player.pause(); player.src = ""; }
  
  // Check if we have a playable CDN video URL
  var playable = isPlayableVideoUrl(url);
  
  if (playable) {
    logDebug("Attempting to play video...");
    if (viewerPlaceholder) viewerPlaceholder.style.display = "none";
    if (player) {
      player.style.display = "block";
      player.src = url;
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

function showVideoFallback(linkUrl, thumbnailUrl) {
  if (player) player.style.display = "none";
  if (viewerPlaceholder) {
    viewerPlaceholder.style.display = "flex";
    var thumbHtml = thumbnailUrl ? 
      '<img src="' + thumbnailUrl + '" style="max-width:200px;max-height:200px;border-radius:8px;margin-bottom:15px;">' : 
      '<div style="font-size:60px;margin-bottom:15px;">🎬</div>';
    
    viewerPlaceholder.innerHTML = '<div style="text-align:center;padding:20px;">' +
      thumbHtml +
      '<p style="margin-bottom:15px;color:#aaa;">Direct video URL not available</p>' +
      (linkUrl ? '<a href="' + linkUrl + '" target="_blank" class="btn-link">▶ Open on Instagram</a>' : '') +
      '</div>';
  }
}

// Render grid
function renderGrid() {
  if (!grid) return;
  grid.innerHTML = "";

  var unfilteredCount = getCurrentItems().length;
  var items = getFilteredItems();
  var totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

  renderSearchMeta(items.length, unfilteredCount);

  if (items.length === 0) {
    if (searchQuery) {
      // Distinct empty state for "no matches" vs "no captures yet"
      grid.innerHTML =
        '<div class="empty-state">' +
          '<div class="es-icon" aria-hidden="true">🔎</div>' +
          '<h3>No matches</h3>' +
          '<p>No ' + currentTab + ' match <strong>' + escapeHtml(searchQuery) + '</strong>. ' +
          'Try different keywords, or use <code>@user</code> / <code>#tag</code> to narrow the field.</p>' +
          '<button class="btn-link" id="empty-clear-search">Clear search</button>' +
        '</div>';
      var clearBtn = document.getElementById("empty-clear-search");
      if (clearBtn) clearBtn.onclick = function () { setSearchQuery(""); };
    } else {
      var emptyIcon = currentTab === "videos" ? "▶" : "🖼";
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
  
  var start = (currentPage - 1) * ITEMS_PER_PAGE;
  var end = Math.min(start + ITEMS_PER_PAGE, items.length);
  var pageItems = items.slice(start, end);
  
  pageItems.forEach(function(item, idx) {
    var globalIdx = start + idx;
    var card = document.createElement("div");
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
    var ownerForLabel = (item.metadata && item.metadata.owner) ? " by @" + item.metadata.owner : "";
    var sizeForLabel = (item.carouselSize && item.carouselSize > 1) ? ", album of " + item.carouselSize : "";
    card.setAttribute(
      "aria-label",
      (currentTab === "videos" ? "Video " : "Image ") + (globalIdx + 1) + ownerForLabel + sizeForLabel
    );
    
    var thumbUrl = getThumbnail(item) || getUrl(item);
    
    if (currentTab === "videos") {
      // Video thumbnail
      if (thumbUrl && thumbUrl.indexOf(".mp4") === -1) {
        var img = document.createElement("img");
        img.className = "thumb";
        img.src = thumbUrl;
        img.loading = "lazy";
        img.onerror = function() {
          this.outerHTML = '<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:#222;"><span style="font-size:40px;">▶</span></div>';
        };
        card.appendChild(img);
      } else {
        var placeholder = document.createElement("div");
        placeholder.className = "thumb";
        placeholder.style.cssText = "display:flex;align-items:center;justify-content:center;background:#222;";
        placeholder.innerHTML = '<span style="font-size:40px;">▶</span>';
        card.appendChild(placeholder);
      }
      
      var badge = document.createElement("div");
      badge.className = "video-badge";
      badge.textContent = "▶ Video";
      card.appendChild(badge);
    } else {
      // Image thumbnail
      var img = document.createElement("img");
      img.className = "thumb";
      img.src = thumbUrl;
      img.loading = "lazy";
      img.onerror = function() {
        this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3C/svg%3E";
      };
      card.appendChild(img);
    }

    // Carousel indicator — Instagram's own two-square glyph + count, no pill
    // background. Click expands the card into a horizontal slide drawer.
    if (item.carouselSize && item.carouselSize > 1) {
      var carBadge = document.createElement("button");
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
        expandCarousel(card, item);
        carBadge.setAttribute("aria-expanded",
          card.classList.contains("carousel-expanded") ? "true" : "false");
      });
      card.appendChild(carBadge);
    }

    // Owner overlay (only when metadata is present)
    if (item.metadata && item.metadata.owner) {
      var ovl = document.createElement("div");
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
      trackItemView(item);
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
  
  var prev = document.createElement("button");
  prev.className = "page-btn";
  prev.textContent = "←";
  prev.disabled = currentPage === 1;
  prev.onclick = function() { if (currentPage > 1) { currentPage--; renderGrid(); } };
  paginationEl.appendChild(prev);
  
  for (var i = 1; i <= totalPages; i++) {
    if (i <= 3 || i > totalPages - 2 || Math.abs(i - currentPage) <= 1) {
      (function(page) {
        var btn = document.createElement("button");
        btn.className = "page-btn" + (page === currentPage ? " active" : "");
        btn.textContent = page;
        btn.onclick = function() { currentPage = page; renderGrid(); };
        paginationEl.appendChild(btn);
      })(i);
    } else if (i === 4 || i === totalPages - 2) {
      var dots = document.createElement("span");
      dots.textContent = "...";
      dots.style.padding = "0 8px";
      paginationEl.appendChild(dots);
    }
  }
  
  var next = document.createElement("button");
  next.className = "page-btn";
  next.textContent = "→";
  next.disabled = currentPage === totalPages;
  next.onclick = function() { if (currentPage < totalPages) { currentPage++; renderGrid(); } };
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

// Load data from storage
function loadData() {
  logDebug("Loading fresh data from storage...");
  markSeen();
  
  // Force fresh read from storage
  chrome.storage.local.get(null, function(result) {
    logDebug("Storage keys: " + Object.keys(result).join(", "));
    
    // Try rich data first
    if (result.igExporterData) {
      allMedia.images = result.igExporterData.images || [];
      allMedia.videos = result.igExporterData.videos || [];
      logDebug("Loaded: " + allMedia.images.length + " images, " + allMedia.videos.length + " videos");
      
      // Show newest items first
      if (allMedia.images.length > 0) {
        logDebug("Newest image: " + (allMedia.images[allMedia.images.length - 1]?.url || "none").substring(0, 60));
      }
    } else if (result.imageUrls || result.videoUrls) {
      // Fallback to legacy
      allMedia.images = (result.imageUrls || []).map(function(url) {
        return { type: 'image', url: url, thumbnail: url };
      });
      allMedia.videos = (result.videoUrls || []).map(function(url) {
        return { type: 'video', url: url };
      });
      logDebug("Loaded legacy: " + allMedia.images.length + " images, " + allMedia.videos.length + " videos");
    } else {
      logDebug("No data found in storage");
      allMedia.images = [];
      allMedia.videos = [];
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
  var label = currentTab === "images" ? "Images" : "Videos";
  var copyBtn = document.getElementById("copy");
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
  return {
    format: "instagram-saved-media-exporter",
    formatVersion: EXPORT_FORMAT_VERSION,
    extensionVersion: extensionVersion || null,
    exportedAt: new Date().toISOString(),
    images: Array.isArray(images) ? images.slice() : [],
    videos: Array.isArray(videos) ? videos.slice() : []
  };
}

// Parse imported file text. Returns one of:
//   { format: 'json', images: [...], videos: [...] }  — full backup
//   { format: 'txt',  urls: [...] }                   — legacy URL list
// Throws on completely unparseable input.
function parseImportPayload(text) {
  var trimmed = (text || "").trim();
  if (!trimmed) {
    throw new Error("Empty file");
  }

  // JSON first: a valid backup starts with `{` and parses as our schema.
  if (trimmed.charAt(0) === "{") {
    var data;
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
  var urls = trimmed.split(/\r?\n/)
    .map(function(l) { return l.trim(); })
    .filter(Boolean);
  if (!urls.length) {
    throw new Error("No URLs found in file");
  }
  return { format: "txt", urls: urls };
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
    var slideshowControls = document.getElementById("slideshow-controls");
    if (slideshowControls) {
      slideshowControls.style.display = currentTab === "videos" ? "none" : "flex";
    }
    
    // Track tab switch
    if (window.Analytics) {
      Analytics.trackButtonClick('tab_' + currentTab, 'gallery');
    }
  };
});

// Set initial button labels
updateButtonLabels();

// Button handlers
document.getElementById("download-current")?.addEventListener("click", async function() {
  if (window.Analytics) Analytics.trackButtonClick('download', 'gallery');
  if (!currentItem) { setStatus("Select an item first"); return; }
  var url = getUrl(currentItem);
  var isVideo = currentTab === "videos";
  
  if (url) {
    if (isVideo) {
      // Videos have CORS restrictions - open in new tab for manual save
      setStatus("Opening video - right-click to save");
      window.open(url, '_blank');
      
      // Track download
      if (window.Analytics) {
        Analytics.trackDownload('single', 'video', 1);
      }
    } else {
      // Images can be fetched as blob
      setStatus("Downloading...");
      try {
        var response = await fetch(url);
        var blob = await response.blob();
        var blobUrl = URL.createObjectURL(blob);
        
        var a = document.createElement("a");
        a.href = blobUrl;
        a.download = "instagram_" + Date.now() + ".jpg";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        
        setStatus("Download complete!");
        
        // Track download
        if (window.Analytics) {
          Analytics.trackDownload('single', 'image', 1);
        }
      } catch (err) {
        console.error("Download failed:", err);
        setStatus("Download failed - try right-click > Save As");
      }
    }
  }
});

document.getElementById("copy")?.addEventListener("click", function() {
  var urls = getCurrentItems().map(getUrl).filter(Boolean);
  navigator.clipboard.writeText(urls.join("\n")).then(function() {
    setStatus("Copied " + urls.length + " URLs");
    
    // Track copy
    if (window.Analytics) {
      Analytics.trackButtonClick('copy_urls', 'gallery');
      Analytics.trackFeature('copy_urls', { count: urls.length, type: currentTab });
    }
  });
});

document.getElementById("export")?.addEventListener("click", function() {
  var extVersion = null;
  try { extVersion = chrome.runtime.getManifest().version; } catch (_) {}
  var payload = buildExportPayload(allMedia.images, allMedia.videos, extVersion);
  var json = JSON.stringify(payload, null, 2);
  var blob = new Blob([json], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  // Date stamp so successive exports don't overwrite each other.
  var stamp = new Date().toISOString().slice(0, 10);
  a.download = "instagram-export-" + stamp + ".json";
  a.click();

  var total = payload.images.length + payload.videos.length;
  setStatus("Exported " + total + " items (" +
    payload.images.length + " images, " + payload.videos.length + " videos)");

  if (window.Analytics) {
    Analytics.trackButtonClick('export_all', 'gallery');
    Analytics.trackFeature('export_all', {
      images: payload.images.length,
      videos: payload.videos.length
    });
  }
});

document.getElementById("clear")?.addEventListener("click", function() {
  // Destructive + irreversible — confirm first.
  if (!confirm("Delete all captured images and videos? This cannot be undone.")) {
    return;
  }

  // Track before clearing
  if (window.Analytics) {
    Analytics.trackButtonClick('clear_all', 'gallery');
    Analytics.trackFeature('clear_data', {
      images_cleared: allMedia.images.length,
      videos_cleared: allMedia.videos.length
    });
  }

  allMedia.images = [];
  allMedia.videos = [];

  // Stop any in-flight playback/slideshow and unwire the viewer from the
  // about-to-be-deleted item before storage commits.
  resetViewer();
  // A lingering search query against empty data shows "Showing 0 of 0" —
  // reset it so the user sees a clean "nothing captured yet" state.
  setSearchQuery("");

  chrome.storage.local.set({
    igExporterData: { images: [], videos: [] }
  }, function() {
    updateCounts();
    renderGrid();
    setStatus("Cleared all data");
    logDebug("Data cleared");
  });
});

document.getElementById("import")?.addEventListener("click", function() {
  if (window.Analytics) Analytics.trackButtonClick('import', 'gallery');
  document.getElementById("file-input")?.click();
});

document.getElementById("file-input")?.addEventListener("change", function() {
  var file = this.files[0];
  if (!file) return;

  var fileInput = this;
  var reader = new FileReader();
  reader.onload = function() {
    var parsed;
    try {
      parsed = parseImportPayload(reader.result);
    } catch (e) {
      setStatus("Import failed: " + e.message);
      fileInput.value = "";
      return;
    }

    if (parsed.format === "json") {
      // Full-fidelity backup: replace both tabs, preserve all metadata.
      allMedia.images = parsed.images;
      allMedia.videos = parsed.videos;
      var total = parsed.images.length + parsed.videos.length;
      setStatus("Imported " + total + " items (" +
        parsed.images.length + " images, " + parsed.videos.length + " videos)");
      if (window.Analytics) {
        Analytics.trackFeature('imported_json', {
          images: parsed.images.length,
          videos: parsed.videos.length
        });
      }
    } else {
      // Legacy URL list: drop into the current tab only, no metadata.
      var items = parsed.urls.map(function(url) {
        return { type: currentTab === 'images' ? 'image' : 'video', url: url, thumbnail: url };
      });
      if (currentTab === "images") {
        allMedia.images = items;
      } else {
        allMedia.videos = items;
      }
      setStatus("Imported " + items.length + " URLs (legacy format, metadata not included)");
      if (window.Analytics) {
        Analytics.trackFeature('imported_txt', { count: items.length, type: currentTab });
      }
    }

    chrome.storage.local.set({
      igExporterData: { images: allMedia.images, videos: allMedia.videos }
    });

    updateCounts();
    renderGrid();
    fileInput.value = "";  // allow re-importing the same file
  };
  reader.readAsText(file);
});

document.getElementById("donate")?.addEventListener("click", function() {
  if (window.Analytics) Analytics.trackButtonClick('donate', 'gallery');
  window.open("https://www.patreon.com/join/THYProduction", "_blank");
});


// Listen for storage changes
chrome.storage.onChanged.addListener(function(changes, area) {
  if (area !== "local") return;
  
  logDebug("Storage changed: " + Object.keys(changes).join(", "));
  
  if (changes.igExporterData && changes.igExporterData.newValue) {
    allMedia.images = changes.igExporterData.newValue.images || [];
    allMedia.videos = changes.igExporterData.newValue.videos || [];
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

// Search input wiring — debounced live filter on caption / owner / hashtags.
(function wireSearch() {
  var input = document.getElementById("search-input");
  var clearBtn = document.getElementById("search-clear");
  if (!input) return;

  var debounceTimer = null;
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

// Track page view
if (window.Analytics) {
  Analytics.trackPageView('gallery', 'Instagram Media Gallery');
}

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
  var grouped = getCurrentItems();
  var flat = [];
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
  var items = getFullscreenItems();
  if (fullscreenCounter) {
    fullscreenCounter.textContent = (currentFullscreenIndex + 1) + " / " + items.length;
  }
}

// Show item in fullscreen
function showFullscreenItem(index) {
  var items = getFullscreenItems();
  if (index < 0) index = items.length - 1;
  if (index >= items.length) index = 0;
  currentFullscreenIndex = index;
  
  var item = items[index];
  var url = getUrl(item);
  // Only check item.type for video detection - don't check URL patterns as they're unreliable
  var isVideo = item && item.type === 'video';
  
  // Stop any playing video
  if (fullscreenVideo) {
    fullscreenVideo.pause();
    fullscreenVideo.src = '';
  }
  
  // Show/hide slideshow buttons based on content type
  var btn2 = document.getElementById("fs-slide-2");
  var btn3 = document.getElementById("fs-slide-3");
  var btn5 = document.getElementById("fs-slide-5");
  var stopBtn = document.getElementById("fs-slide-stop");
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
      fullscreenVideo.src = item.videoUrl || item.url || url;
      fullscreenVideo.load();
    }
  } else {
    // Show image, hide video
    if (fullscreenVideo) fullscreenVideo.style.display = 'none';
    if (fullscreenImage) {
      fullscreenImage.style.display = 'block';
      fullscreenImage.src = url;
    }
  }
  updateFullscreenCounter();
}

// Open fullscreen
function openFullscreen() {
  var items = getFullscreenItems();
  if (items.length === 0) return;
  
  // Find current item index
  if (currentItem) {
    var url = getUrl(currentItem);
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
  
  // Track fullscreen usage
  if (window.Analytics) {
    Analytics.trackButtonClick('fullscreen', 'gallery');
    Analytics.trackFeature('fullscreen_opened', { type: currentTab });
  }
}

// Close fullscreen
function closeFullscreen() {
  if (window.Analytics) Analytics.trackButtonClick('fullscreen_close', 'gallery');
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

// Next/Prev in fullscreen
function fullscreenNextItem() {
  showFullscreenItem(currentFullscreenIndex + 1);
}

function fullscreenPrevItem() {
  showFullscreenItem(currentFullscreenIndex - 1);
}

// Slideshow controls. Speed buttons (2s / 3s / 5s) stay visible at all times
// (when an image is showing); the active one gets `.active` so the user can
// see which speed is in effect and switch on the fly. The Stop button only
// appears while a slideshow is running.
var SLIDESHOW_SPEED_IDS = ["fs-slide-2", "fs-slide-3", "fs-slide-5"];

function clearSlideshowActiveState() {
  for (var i = 0; i < SLIDESHOW_SPEED_IDS.length; i++) {
    var b = document.getElementById(SLIDESHOW_SPEED_IDS[i]);
    if (b) b.classList.remove("active");
  }
}

function setSlideshowActiveSpeed(intervalMs) {
  clearSlideshowActiveState();
  for (var i = 0; i < SLIDESHOW_SPEED_IDS.length; i++) {
    var b = document.getElementById(SLIDESHOW_SPEED_IDS[i]);
    if (!b) continue;
    if (parseInt(b.getAttribute("data-interval"), 10) === intervalMs) {
      b.classList.add("active");
    }
  }
}

function startSlideshow(intervalMs) {
  stopSlideshow();
  slideshowInterval = setInterval(function() {
    fullscreenNextItem();
  }, intervalMs);

  // Show stop button; mark the chosen speed as active.
  var stopBtn = document.getElementById("fs-slide-stop");
  if (stopBtn) stopBtn.style.display = "inline-block";
  setSlideshowActiveSpeed(intervalMs);

  if (window.Analytics) {
    Analytics.trackButtonClick('slideshow_start', 'gallery');
    Analytics.trackFeature('slideshow_started', { interval_seconds: intervalMs / 1000 });
  }
}

function stopSlideshow() {
  if (window.Analytics) Analytics.trackButtonClick('slideshow_stop', 'gallery');
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
  var stopBtn = document.getElementById("fs-slide-stop");
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
    fullscreenNextItem();
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
    fullscreenNextItem();
  } else if (e.key === "ArrowLeft") {
    fullscreenPrevItem();
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
    var interval = parseInt(btn.getAttribute("data-interval"));
    if (interval) {
      openFullscreen();
      setTimeout(function() {
        startSlideshow(interval);
      }, 300);
    }
  });
});
