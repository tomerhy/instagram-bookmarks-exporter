/**
 * Saved Posts Backup & Export - content script (isolated world)
 *
 * Owns all state and all storage writes. This is the security boundary: the
 * MAIN-world reader (capture-hook.js) can only offer data over
 * window.postMessage, and everything offered is re-validated here before it is
 * allowed anywhere near chrome.storage.local.
 *
 * Two invariants this file exists to hold:
 *   1. Capture is off until the user presses Start Capture, and off again the
 *      moment they press Stop or reload the page. See `captureActive`.
 *   2. Every URL that reaches storage passed the shared allowlist in
 *      url-allowlist.js. See validateMediaMessage().
 *
 * The storage key is still `igExporterData` for backward compatibility — a
 * user upgrading from an earlier version keeps the library they already have.
 */

(function() {
  'use strict';

  // Prevent double injection
  if (window.__sbeContentInjected) return;
  window.__sbeContentInjected = true;

  console.log('[SBE] Content script loaded');

  // ============================================
  // EXTENSION CONTEXT GUARDS
  // ============================================
  // In MV3, a content script can outlive the extension's service worker
  // (eviction, update, manual reload). Once that happens every chrome.*
  // call throws "Extension context invalidated". We wrap our chrome.*
  // usage so the page-side capture loop survives the disconnect quietly,
  // surfaces a single user-visible status, and stops retrying.

  let extensionContextLost = false;

  function isExtensionContextOk() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  function noteContextLoss(where) {
    if (extensionContextLost) return;
    extensionContextLost = true;
    console.warn('[SBE] Extension context invalidated at ' + where +
      '. Refresh this Instagram tab to resume capturing.');
    // Note: prior versions also tried to surface this via setStatus() to the
    // floating in-page panel. The panel was deleted in v4.4.0 (item 20); the
    // popup is the only UI surface now, and the popup polls storage so it'll
    // pick up the dead-context state on its next refresh.
  }

  function safeStorageSet(items, cb) {
    if (!isExtensionContextOk()) { noteContextLoss('storage.set'); return; }
    try {
      chrome.storage.local.set(items, function () {
        try {
          if (chrome.runtime && chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || 'unknown';
            if (/context invalidated|Receiving end does not exist/i.test(msg)) {
              noteContextLoss('storage.set (lastError)');
            } else {
              console.error('[SBE] Storage error:', msg);
            }
            return;
          }
          if (cb) cb();
        } catch (_) { noteContextLoss('storage.set (callback)'); }
      });
    } catch (_) { noteContextLoss('storage.set (throw)'); }
  }

  function safeStorageGet(keys, cb) {
    if (!isExtensionContextOk()) { noteContextLoss('storage.get'); return; }
    try {
      chrome.storage.local.get(keys, function (result) {
        try { if (cb) cb(result || {}); }
        catch (_) { noteContextLoss('storage.get (callback)'); }
      });
    } catch (_) { noteContextLoss('storage.get (throw)'); }
  }

  function safeSendMessage(msg, cb) {
    if (!isExtensionContextOk()) { noteContextLoss('sendMessage'); return; }
    try {
      chrome.runtime.sendMessage(msg, function (response) {
        try {
          if (chrome.runtime && chrome.runtime.lastError) {
            // sendMessage commonly errors when no receiver is listening; we
            // intentionally don't treat that as context loss.
            void chrome.runtime.lastError;
          }
          if (cb) cb(response);
        } catch (_) { noteContextLoss('sendMessage (callback)'); }
      });
    } catch (_) { noteContextLoss('sendMessage (throw)'); }
  }

  // ============================================
  // CAPTURE STATE — OFF BY DEFAULT
  // ============================================
  // Nothing is read from the page and nothing is stored until the user presses
  // Start Capture in the extension popup. This flag is deliberately *not*
  // persisted: every page load, every tab and every navigation starts inert,
  // so simply having instagram.com open never captures anything.

  let captureActive = false;

  // Control channel to capture-hook.js in the MAIN world (which is where the
  // page's own fetch/XHR live). 'start' makes it wrap them, 'stop' unwraps.
  const CONTROL_TYPE = 'SBE_CAPTURE_CONTROL';
  const MEDIA_TYPE = 'SBE_MEDIA';

  function sendCaptureControl(action) {
    try {
      window.postMessage({ type: CONTROL_TYPE, action: action }, window.location.origin);
    } catch (e) {
      console.warn('[SBE] Could not signal capture reader:', e.message);
    }
  }

  // ============================================
  // INBOUND MESSAGE VALIDATION
  // ============================================
  // capture-hook.js runs in the MAIN world, which means it shares a global
  // scope with Instagram's own page code — so its messages arrive over the
  // same window.postMessage channel any page script could write to. Treat
  // every inbound payload as untrusted: verify the sender, the origin, the
  // envelope shape, and the type of every single field before anything is
  // allowed near storage.

  const ALLOWED_MESSAGE_ORIGINS = [
    'https://www.instagram.com',
    'https://instagram.com'
  ];

  const LIMITS = {
    mediaPerMessage: 400,     // matches the reader's per-response cap
    recordsPerBucket: 20000,  // hard ceiling on stored images / videos
    caption: 2200,            // Instagram's own caption limit
    owner: 30,                // Instagram's own username limit
    shortcode: 64,
    hashtags: 60,
    carouselSize: 50,
    timestamp: 40
  };

  function allowedMediaUrl(value) {
    const api = globalThis.SBE_URL;
    if (!api || typeof api.isAllowedMediaUrl !== 'function') return false;
    try { return api.isAllowedMediaUrl(value); } catch (_) { return false; }
  }

  // Optional metadata is sanitized rather than rejected: a caption we cannot
  // trust becomes null, which loses one field. Rejecting the whole record
  // would instead lose media the user asked for.
  function cleanString(value, max) {
    if (typeof value !== 'string') return null;
    const trimmed = value.slice(0, max);
    return trimmed.length ? trimmed : null;
  }

  function cleanOwner(value) {
    const owner = cleanString(value, LIMITS.owner);
    if (!owner) return null;
    return /^[A-Za-z0-9._]+$/.test(owner) ? owner : null;
  }

  function cleanShortcode(value) {
    const code = cleanString(value, LIMITS.shortcode);
    if (!code) return null;
    return /^[A-Za-z0-9_-]+$/.test(code) ? code : null;
  }

  function cleanTimestamp(value) {
    const raw = cleanString(value, LIMITS.timestamp);
    if (!raw) return null;
    const parsed = Date.parse(raw);
    return isNaN(parsed) ? null : raw;
  }

  function cleanCount(value) {
    if (typeof value !== 'number' || !isFinite(value) || value < 0) return null;
    return Math.floor(value);
  }

  function cleanIndex(value, max) {
    if (typeof value !== 'number' || !isFinite(value)) return null;
    const n = Math.floor(value);
    return (n >= 0 && n < max) ? n : null;
  }

  function cleanContext(ctx) {
    if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) return null;
    const size = cleanIndex(ctx.carouselSize, LIMITS.carouselSize + 1);
    return {
      postShortcode: cleanShortcode(ctx.postShortcode),
      caption: cleanString(ctx.caption, LIMITS.caption),
      owner: cleanOwner(ctx.owner),
      takenAt: cleanTimestamp(ctx.takenAt),
      likeCount: cleanCount(ctx.likeCount),
      carouselSize: size && size > 0 ? size : 1,
      carouselIndex: cleanIndex(ctx.carouselIndex, LIMITS.carouselSize)
    };
  }

  // Returns a validated array of {type, url, thumbnail, context}, or null if
  // the envelope itself is malformed. Individual bad items are dropped.
  function validateMediaMessage(event) {
    if (event.source !== window) return null;
    if (ALLOWED_MESSAGE_ORIGINS.indexOf(event.origin) === -1) return null;

    const data = event.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    if (data.type !== MEDIA_TYPE) return null;
    if (!Array.isArray(data.media)) return null;

    const accepted = [];
    const batch = data.media.slice(0, LIMITS.mediaPerMessage);
    for (const item of batch) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      if (item.type !== 'image' && item.type !== 'video') continue;
      if (!allowedMediaUrl(item.url)) continue;
      accepted.push({
        type: item.type,
        url: item.url,
        thumbnail: allowedMediaUrl(item.thumbnail) ? item.thumbnail : null,
        context: cleanContext(item.context)
      });
    }
    return { accepted: accepted, dropped: data.media.length - accepted.length };
  }

  // ============================================
  // LISTEN FOR MEDIA FROM THE MAIN-WORLD READER
  // ============================================

  window.addEventListener('message', function(event) {
    // The capture gate comes first, before any parsing work: while capture is
    // off, an IG_EXPORTER/SBE_MEDIA message is discarded unread.
    if (!captureActive) return;

    const result = validateMediaMessage(event);
    if (!result) return;

    if (atRecordLimit()) {
      console.warn('[SBE] Storage record limit reached (' +
        LIMITS.recordsPerBucket + ' per type); ignoring further captures.');
      return;
    }

    let added = 0;
    let skipped = 0;
    result.accepted.forEach(item => {
      const opts = contextToOptions(item.context);
      if (item.type === 'video') {
        if (addVideo(item.url, null, item.thumbnail, opts)) added++; else skipped++;
      } else {
        if (addImage(item.url, null, item.thumbnail || item.url, opts)) added++; else skipped++;
      }
    });

    const totalItems = state.images.length + state.videos.length;
    console.log(`[SBE] +${added} new, ${skipped} dupes, ${result.dropped} rejected | ` +
      `Total: ${state.images.length} imgs + ${state.videos.length} vids = ${totalItems}`);

    if (added > 0) {
      saveToStorage();
    }
  });

  // ============================================
  // STATE
  // ============================================

  const state = {
    images: [],
    videos: [],
    seenUrls: new Set(),
    capturedShortcodes: new Set()   // Track which posts we've already captured
  };

  // Guard against unbounded growth. Both a storage-quota protection and a
  // denial-of-service guard: without it a page that keeps emitting media could
  // grow chrome.storage.local without limit.
  function atRecordLimit() {
    return state.images.length >= LIMITS.recordsPerBucket ||
           state.videos.length >= LIMITS.recordsPerBucket;
  }


  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  // Pull #hashtags out of a caption. Unicode-aware so non-ASCII tags work.
  function extractHashtags(caption) {
    if (!caption || typeof caption !== 'string') return [];
    const matches = caption.match(/#[\p{L}\p{N}_]+/gu) || [];
    return matches.map(h => h.slice(1));
  }

  // Translate the wire-format context (from injector.js) into the options shape
  // that addImage/addVideo expect. Keeping the wire and storage shapes separate
  // means future fields can be added without breaking either side.
  function contextToOptions(ctx) {
    if (!ctx || typeof ctx !== 'object') return null;
    return {
      postShortcode: ctx.postShortcode || null,
      carouselIndex: typeof ctx.carouselIndex === 'number' ? ctx.carouselIndex : null,
      carouselSize: ctx.carouselSize || 1,
      metadata: {
        caption: ctx.caption || null,
        owner: ctx.owner || null,
        takenAt: ctx.takenAt || null,
        likeCount: typeof ctx.likeCount === 'number' ? ctx.likeCount : null,
        hashtags: extractHashtags(ctx.caption)
      }
    };
  }

  // Normalize URL by removing query params (for deduplication)
  function normalizeUrl(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      // Keep pathname + ig_cache_key (unique identifier for each media item)
      const cacheKey = parsed.searchParams.get('ig_cache_key') || '';
      const stp = parsed.searchParams.get('stp') || '';
      // Create a unique key combining path and unique identifiers
      return parsed.pathname + '|' + cacheKey + '|' + stp;
    } catch (e) {
      // If URL parsing fails, return as-is
      return url;
    }
  }

  // Build the persisted item shape. Keeps grouping + metadata fields together
  // so addImage/addVideo stay symmetric.
  function buildItem(type, url, postUrl, thumbnail, options) {
    const opts = options || {};
    const shortcode = opts.postShortcode || null;
    const finalPostUrl = postUrl || (shortcode ? `https://www.instagram.com/p/${shortcode}/` : null);
    return {
      type: type,
      url: url || null,
      thumbnail: thumbnail || (type === 'image' ? url : null),
      postUrl: finalPostUrl,
      postShortcode: shortcode,
      carouselIndex: typeof opts.carouselIndex === 'number' ? opts.carouselIndex : null,
      carouselSize: opts.carouselSize || 1,
      metadata: opts.metadata || null,
      scrapedAt: new Date().toISOString()
    };
  }

  function addImage(url, postUrl, thumbnail, options) {
    if (!url) return false;

    // Use normalized URL for duplicate check
    const normalizedUrl = normalizeUrl(url);
    if (state.seenUrls.has(normalizedUrl)) {
      // Correctly skip duplicates
      return false;
    }
    state.seenUrls.add(normalizedUrl);

    state.images.push(buildItem('image', url, postUrl, thumbnail || url, options));
    console.log('[SBE] Added image:', url.substring(0, 60));
    return true;
  }

  function addVideo(url, postUrl, thumbnail, options) {
    const videoUrl = url || null;
    const key = videoUrl || postUrl;
    if (!key) return false;

    // Use normalized URL for duplicate check
    const normalizedKey = normalizeUrl(key);
    if (state.seenUrls.has(normalizedKey)) {
      // Correctly skip duplicates
      return false;
    }
    state.seenUrls.add(normalizedKey);

    const video = buildItem('video', videoUrl, postUrl, thumbnail, options);
    state.videos.push(video);

    console.log('[SBE] Added video:', {
      hasDirectUrl: !!videoUrl,
      urlPreview: (videoUrl || postUrl || '').substring(0, 80),
      hasThumbnail: !!thumbnail
    });
    return true;
  }

  // ============================================
  // CAPTURE LOOP
  // ============================================
  // Scroll the page the user is already looking at, so Instagram loads the
  // next slice of their own saved feed. The MAIN-world reader parses the
  // responses that arrive as a result. Nothing here issues a request of its
  // own and nothing here talks to a private API.

  let autoClickRunning = false;
  
  function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ============================================
  // FIRST-RUN CONSENT
  // ============================================
  // The popup owns the disclosure UI, but the gate is enforced here too: this
  // is the only place that can actually turn capture on, so this is where the
  // check has to hold. Reading the flag from storage (rather than trusting a
  // field on the incoming message) means a forged START_CAPTURE cannot bypass
  // the disclosure.

  const CONSENT_KEY = 'sbeConsentAcceptedAt';

  function withConsent(cb) {
    safeStorageGet([CONSENT_KEY], (result) => {
      const stamp = result && result[CONSENT_KEY];
      cb(typeof stamp === 'number' && stamp > 0);
    });
  }

  async function startCapture() {
    if (autoClickRunning) {
      console.log('[SBE] Already running');
      return;
    }

    autoClickRunning = true;
    captureActive = true;
    // Tell the MAIN-world reader to wrap fetch/XHR. Until this message the
    // page's own networking is completely untouched.
    sendCaptureControl('start');


    // SCROLL-ONLY MODE: Just scroll to trigger Instagram's API loading
    // The injector.js will capture media from API responses automatically
    console.log('[SBE] ========================================');
    console.log('[SBE] SCROLL-ONLY MODE');
    console.log('[SBE] Scrolling to load posts, API interception will capture media');
    console.log('[SBE] ========================================');
    
    const startImages = state.images.length;
    const startVideos = state.videos.length;
    let noNewContentCount = 0;
    const maxNoNewContent = 5; // Stop after 5 scrolls with no new content
    let scrollCount = 0;
    
    // SCROLL-ONLY LOOP: Just scroll to trigger Instagram's API loading
    while (autoClickRunning) {
      scrollCount++;
      
      // Track media count before scroll
      const mediaBeforeScroll = state.images.length + state.videos.length;
      
      // Get document dimensions
      const docHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const currentScroll = window.scrollY;
      
      // Check if we're near the bottom
      const nearBottom = (currentScroll + viewportHeight) >= (docHeight - 200);
      
      if (nearBottom) {
        // We're at the bottom, wait for more content to load
        noNewContentCount++;
        console.log('[SBE] Near bottom, waiting for content... (attempt', noNewContentCount + '/' + maxNoNewContent + ')');
        
        if (noNewContentCount >= maxNoNewContent) {
          console.log('[SBE] No more content loading, stopping');
          break;
        }
        
        // Trigger scroll event to prompt loading
        window.dispatchEvent(new Event('scroll', { bubbles: true }));
        await sleep(randomDelay(600, 1000));
        
        // Check if new media was captured
        const mediaAfterWait = state.images.length + state.videos.length;
        if (mediaAfterWait > mediaBeforeScroll) {
          noNewContentCount = 0; // Reset counter if we got new content
          console.log('[SBE] New media captured:', mediaAfterWait - mediaBeforeScroll);
        }
        
        continue;
      }
      
      // Scroll down
      const scrollAmount = viewportHeight * 0.8;
      const targetScroll = currentScroll + scrollAmount;
      
      console.log('[SBE] Scroll #' + scrollCount + ' | Media so far:', state.images.length, 'imgs +', state.videos.length, 'vids');
      
      window.scrollTo({ top: targetScroll, behavior: 'auto' });
      
      // Dispatch scroll event to ensure Instagram detects it
      window.dispatchEvent(new Event('scroll', { bubbles: true }));
      
      // Wait for Instagram to process and load content (faster)
      await sleep(randomDelay(400, 600));
      
      // Check if new media was captured
      const mediaAfterScroll = state.images.length + state.videos.length;
      if (mediaAfterScroll > mediaBeforeScroll) {
        noNewContentCount = 0; // Reset counter
        console.log('[SBE] Captured', mediaAfterScroll - mediaBeforeScroll, 'new items');
      }
    }
    
    // The scroll loop can also end on its own (nothing new left to load).
    // Tear the reader down on that path too, so a self-terminating capture
    // leaves the page exactly as unpatched as an explicit Stop does.
    stopCapture();

    // Summary
    const newImages = state.images.length - startImages;
    const newVideos = state.videos.length - startVideos;

    console.log('[SBE] ========================================');
    console.log('[SBE] SCROLL COMPLETE:');
    console.log('[SBE]   Scrolls:', scrollCount);
    console.log('[SBE]   Images captured:', newImages);
    console.log('[SBE]   Videos captured:', newVideos);
    console.log('[SBE]   Total:', state.images.length, 'imgs +', state.videos.length, 'vids');
    console.log('[SBE] ========================================');
    
    saveToStorage();
  }
  
  // Note: an earlier click-based capture mode (startClickCapture) lived here
  // before v4.4.0. It opened each post modal to walk carousel slides. Removed
  // as part of item 10; the auto-scroll path is the only capture pipeline now.
  // If revival is needed, git blame this comment.

  // Full teardown. Ordering matters: drop the gate first so any response
  // already in flight is discarded, then unwrap the page's fetch/XHR, then
  // stop the DOM observers. Safe to call when nothing is running.
  function stopCapture() {
    captureActive = false;
    autoClickRunning = false;
    sendCaptureControl('stop');
    console.log('[SBE] Capture stopped; page networking restored');
  }
  
  // ============================================
  // STORAGE
  // ============================================

  function saveToStorage() {
    if (extensionContextLost) return;  // give up quietly once we know
    const data = {
      images: state.images,
      videos: state.videos
    };
    safeStorageSet({ igExporterData: data }, function () {
      console.log('[SBE] Saved:', state.images.length, 'images,', state.videos.length, 'videos');
    });
  }

  function loadFromStorage() {
    safeStorageGet(['igExporterData'], (result) => {
      if (result.igExporterData) {
        // Sanitise on the way IN, through the same authoritative path the
        // gallery uses. Without this, a legacy record written by 4.4.0 or
        // earlier would be read into memory unvalidated and then written
        // straight back out by the next saveToStorage() — re-persisting the
        // very values 4.4.2 exists to remove.
        const lib = globalThis.SBE_LIB;
        if (lib && typeof lib.sanitizeLibrary === 'function') {
          const clean = lib.sanitizeLibrary(result.igExporterData);
          state.images = clean.images;
          state.videos = clean.videos;
          if (clean.changed) {
            console.log('[SBE] Sanitised legacy library on load: removed ' +
              clean.removedRecords + ' record(s), ' + clean.removedFields + ' field(s)');
            // Persist immediately so the unsafe values are gone from storage
            // even if the user never opens the gallery.
            saveToStorage();
          }
        } else {
          // Fail closed rather than loading unvalidated records.
          console.warn('[SBE] SBE_LIB unavailable; starting with an empty library');
          state.images = [];
          state.videos = [];
        }

        // Rebuild seenUrls from loaded data (using normalized URLs)
        state.images.forEach(i => { 
          if (i.url) state.seenUrls.add(normalizeUrl(i.url));
        });
        state.videos.forEach(v => { 
          if (v.url) state.seenUrls.add(normalizeUrl(v.url));
          if (v.postUrl) state.seenUrls.add(normalizeUrl(v.postUrl));
        });

        console.log('[SBE] Loaded:', state.images.length, 'images,', state.videos.length, 'videos');
      }
    });
  }

  // ============================================
  // EXTERNAL STORAGE CLEAR (e.g. gallery's "Clear All" button)
  // ============================================
  // Without this, the in-memory state outlives the storage clear and:
  //   1. the popup keeps showing stale counts via GET_STATS
  //   2. the next saveToStorage() call resurrects the cleared items
  //   3. capturedShortcodes lingers and blocks re-capture of those posts
  // Always reset on a cleared write — clearing already-empty state is a no-op
  // (no feedback loop, since this branch doesn't write back to storage).

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes.igExporterData) return;
    const next = changes.igExporterData.newValue;
    const isCleared = !next || (
      Array.isArray(next.images) && next.images.length === 0 &&
      Array.isArray(next.videos) && next.videos.length === 0
    );
    if (isCleared) {
      state.images = [];
      state.videos = [];
      state.seenUrls.clear();
      state.capturedShortcodes.clear();
      console.log('[SBE] Storage cleared externally; in-memory state reset');
    }
  });

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'PING':
        sendResponse({ ok: true });
        break;

      case 'GET_STATS':
        sendResponse({
          images: state.images.length,
          videos: state.videos.length,
          total: state.images.length + state.videos.length,
          isCapturing: autoClickRunning
        });
        break;

      case 'START_CAPTURE':
        // Async: the consent flag lives in storage, so the response has to
        // wait for the read. Returning true keeps the channel open.
        withConsent((granted) => {
          if (!granted) {
            sendResponse({ ok: false, reason: 'consent_required' });
            return;
          }
          startCapture();
          sendResponse({
            ok: true,
            images: state.images.length,
            videos: state.videos.length
          });
        });
        return true;

      case 'STOP_CAPTURE':
        stopCapture();
        sendResponse({ ok: true });
        break;

      case 'CLEAR':
        console.log('[SBE] CLEAR command received - clearing ALL data');
        state.images = [];
        state.videos = [];
        state.seenUrls.clear();
        state.capturedShortcodes.clear();
        safeStorageSet({
          igExporterData: { images: [], videos: [] }
        });
        sendResponse({ ok: true });
        break;
        
    }
    return true;
  });

  // ============================================
  // INIT
  // ============================================

  function init() {
    // Load existing data from storage
    loadFromStorage();
    console.log('[SBE] Ready. Click extension icon to use.');
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  // Test seam: only fires when tests set __SBE_TEST_HOOKS__ before
  // loading the source. Has no effect in the browser.
  if (typeof globalThis !== 'undefined' && globalThis.__SBE_TEST_HOOKS__) {
    globalThis.__SBE_TEST_HOOKS__.content = {
      extractHashtags, contextToOptions, buildItem, normalizeUrl,
      addImage, addVideo, state, atRecordLimit,
      loadFromStorage, saveToStorage,
      isExtensionContextOk, safeStorageSet, safeStorageGet, safeSendMessage,
      // capture gate + inbound validation (see the compliance tests)
      validateMediaMessage, cleanContext, cleanOwner, cleanShortcode,
      cleanTimestamp, cleanCount, cleanIndex, cleanString,
      startCapture, stopCapture, withConsent,
      LIMITS, CONSENT_KEY, CONTROL_TYPE, MEDIA_TYPE, ALLOWED_MESSAGE_ORIGINS,
      // exposed via getters so tests observe live state, not a snapshot
      get captureActive() { return captureActive; },
      get extensionContextLost() { return extensionContextLost; }
    };
  }

})();
