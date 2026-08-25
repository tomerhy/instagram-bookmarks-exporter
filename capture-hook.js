/**
 * Response reader — runs in the page's MAIN world.
 *
 * Renamed from injector.js in 4.4.1 along with a behavioural change that is
 * the whole point of the file:
 *
 *   Before 4.4.1 this script replaced window.fetch and
 *   XMLHttpRequest.prototype.{open,send} at document_start, unconditionally,
 *   on every instagram.com page load. Every API/GraphQL response was parsed
 *   and forwarded whether or not the user had asked for anything.
 *
 *   From 4.4.1 it installs nothing at load. It sits idle behind a control
 *   channel and only wraps fetch/XHR after the user presses Start Capture in
 *   the extension popup. Pressing Stop unwraps them again.
 *
 * Why this file has to run in the MAIN world at all: an isolated-world content
 * script cannot see the page's own fetch/XHR, so it cannot observe the
 * responses Instagram loads for the page the user is looking at. Nothing here
 * *issues* requests — it only reads responses the page itself already
 * requested and already has. There are no calls to private endpoints, no
 * constructed API requests, and no authentication data of any kind is read.
 *
 * Trust boundary: this script shares a global scope with the page, so the page
 * could forge a control message and switch the reader on. That is deliberately
 * harmless — the reader's only output is a window.postMessage that the
 * isolated world independently validates, and the isolated world drops
 * everything unless the user actually started a capture. See content.js.
 */

(function() {
  if (window.__sbeCaptureHookInstalled) return;
  window.__sbeCaptureHookInstalled = true;

  var CONTROL_TYPE = 'SBE_CAPTURE_CONTROL';
  var MEDIA_TYPE = 'SBE_MEDIA';

  // Parsing limits. An Instagram feed response is a few hundred KB of deeply
  // nested JSON; these keep a hostile or malformed response from turning the
  // walk into a denial of service.
  var MAX_DEPTH = 12;
  var MAX_RESULTS_PER_RESPONSE = 400;
  var MAX_CAPTION_LENGTH = 2200;   // Instagram's own caption limit

  // Only these URL shapes are worth parsing. Matching is on the request the
  // page made, purely to avoid parsing every static asset as JSON.
  function isInterestingUrl(url) {
    return url.indexOf('/api/') !== -1 ||
           url.indexOf('graphql') !== -1 ||
           url.indexOf('/media/') !== -1 ||
           url.indexOf('/info') !== -1 ||
           url.indexOf('/p/') !== -1 ||
           url.indexOf('/reel/') !== -1;
  }

  // Media URL filter. globalThis.SBE_URL comes from url-allowlist.js, loaded
  // ahead of this file in the same world. If the page has torn it out we fail
  // closed and forward nothing — the isolated world would reject it anyway.
  function urlAllowed(value) {
    var api = globalThis.SBE_URL;
    if (!api || typeof api.isAllowedMediaUrl !== 'function') return false;
    try { return api.isAllowedMediaUrl(value); } catch (_) { return false; }
  }

  // --------------------------------------------------------------------------
  // Metadata extraction. Different API shapes (REST v1, GraphQL, XDT) put the
  // same data under different keys.
  // --------------------------------------------------------------------------

  function clampString(value, max) {
    if (typeof value !== 'string') return null;
    return value.length > max ? value.slice(0, max) : value;
  }

  function extractCaption(data) {
    if (!data) return null;
    var raw = null;
    if (data.caption && typeof data.caption === 'object' && typeof data.caption.text === 'string') {
      raw = data.caption.text;
    } else if (typeof data.caption === 'string') {
      raw = data.caption;
    } else if (data.edge_media_to_caption &&
               data.edge_media_to_caption.edges &&
               data.edge_media_to_caption.edges[0] &&
               data.edge_media_to_caption.edges[0].node) {
      raw = data.edge_media_to_caption.edges[0].node.text;
    }
    return clampString(raw, MAX_CAPTION_LENGTH);
  }

  function extractOwner(data) {
    if (!data) return null;
    var name = (data.user && data.user.username) || (data.owner && data.owner.username) || null;
    return clampString(name, 100);
  }

  function extractTakenAt(data) {
    if (!data) return null;
    var ts = (typeof data.taken_at === 'number') ? data.taken_at
           : (typeof data.taken_at_timestamp === 'number') ? data.taken_at_timestamp
           : null;
    if (!ts || !isFinite(ts) || ts <= 0) return null;
    try { return new Date(ts * 1000).toISOString(); } catch (_) { return null; }
  }

  function extractLikeCount(data) {
    if (!data) return null;
    if (typeof data.like_count === 'number' && isFinite(data.like_count)) return data.like_count;
    if (data.edge_media_preview_like && typeof data.edge_media_preview_like.count === 'number') {
      return data.edge_media_preview_like.count;
    }
    return null;
  }

  // Build a context (post-level metadata) when the current node looks like a
  // post root. Carousel children inherit the parent's context but get their
  // own carouselIndex.
  function buildContext(data) {
    var shortcode = clampString(data.code || data.shortcode || null, 64);
    if (!shortcode) return null;
    var carouselSize = 1;
    if (Array.isArray(data.carousel_media)) {
      carouselSize = data.carousel_media.length;
    } else if (data.edge_sidecar_to_children && Array.isArray(data.edge_sidecar_to_children.edges)) {
      carouselSize = data.edge_sidecar_to_children.edges.length;
    }
    return {
      postShortcode: shortcode,
      caption: extractCaption(data),
      owner: extractOwner(data),
      takenAt: extractTakenAt(data),
      likeCount: extractLikeCount(data),
      carouselSize: carouselSize,
      carouselIndex: null
    };
  }

  // Walk an already-received response body and pull out media URLs plus their
  // post context. parentCtx flows down so carousel children carry the parent
  // post's metadata.
  function extractMediaFromData(data, depth, parentCtx, results) {
    depth = depth || 0;
    results = results || [];
    if (depth > MAX_DEPTH || !data || typeof data !== 'object') return results;
    if (results.length >= MAX_RESULTS_PER_RESPONSE) return results;

    // If this node introduces its own shortcode, it becomes the new context.
    var ownCtx = buildContext(data);
    var ctx = ownCtx || parentCtx;

    var candidates = data.image_versions2 && data.image_versions2.candidates;

    if (Array.isArray(data.video_versions) && data.video_versions.length > 0) {
      var videoUrl = data.video_versions[0].url;
      var posterUrl = candidates && candidates[0] && candidates[0].url;
      if (urlAllowed(videoUrl)) {
        results.push({
          type: 'video',
          url: videoUrl,
          thumbnail: urlAllowed(posterUrl) ? posterUrl : null,
          context: ctx
        });
      }
    }

    if (candidates && candidates.length > 0 && !data.video_versions) {
      var imageUrl = candidates[0].url;
      if (data.media_type === 1 && urlAllowed(imageUrl)) {
        results.push({ type: 'image', url: imageUrl, thumbnail: null, context: ctx });
      }
    }

    // Carousel children — pass parent ctx with their own index.
    if (Array.isArray(data.carousel_media)) {
      data.carousel_media.forEach(function(item, idx) {
        var childCtx = ctx ? Object.assign({}, ctx, { carouselIndex: idx }) : null;
        extractMediaFromData(item, depth + 1, childCtx, results);
      });
    }

    // GraphQL sidecar (carousel)
    if (data.edge_sidecar_to_children && Array.isArray(data.edge_sidecar_to_children.edges)) {
      data.edge_sidecar_to_children.edges.forEach(function(edge, idx) {
        if (edge && edge.node) {
          var childCtx = ctx ? Object.assign({}, ctx, { carouselIndex: idx }) : null;
          extractMediaFromData(edge.node, depth + 1, childCtx, results);
        }
      });
    }

    // Items array — sibling posts, each may introduce its own context via
    // buildContext on the next recursion. Pass parentCtx (not ctx) on purpose:
    // these are siblings of the current node, not children of it, so they must
    // NOT inherit the current node's post-level metadata. Don't "fix" this to
    // ctx — it would attach the wrong post's caption/owner to siblings that
    // fail to introduce their own shortcode.
    if (Array.isArray(data.items)) {
      data.items.forEach(function(item) {
        extractMediaFromData(item, depth + 1, parentCtx, results);
      });
    }

    // GraphQL edges — same sibling semantics as `items` above.
    if (Array.isArray(data.edges)) {
      data.edges.forEach(function(edge) {
        if (edge && edge.node) {
          extractMediaFromData(edge.node, depth + 1, parentCtx, results);
        }
      });
    }

    // Recurse into remaining object values (skip keys handled above).
    if (!Array.isArray(data)) {
      var skipKeys = ['video_versions', 'carousel_media', 'items', 'edges',
                      'image_versions2', 'edge_sidecar_to_children'];
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        if (skipKeys.indexOf(keys[i]) === -1) {
          extractMediaFromData(data[keys[i]], depth + 1, ctx, results);
        }
      }
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Install / uninstall
  // --------------------------------------------------------------------------

  var active = false;
  var originalFetch = null;
  var originalXhrOpen = null;
  var originalXhrSend = null;
  var ourFetch = null;
  var ourXhrOpen = null;
  var ourXhrSend = null;

  function forward(media) {
    if (!active || !media.length) return;
    window.postMessage({ type: MEDIA_TYPE, media: media }, window.location.origin);
  }

  function handleBody(url, text) {
    if (!active) return;
    var data;
    try { data = JSON.parse(text); } catch (_) { return; }
    var media;
    try { media = extractMediaFromData(data); } catch (_) { return; }
    if (media.length) forward(media);
  }

  function install() {
    if (ourFetch) return;  // already installed

    originalFetch = window.fetch;
    ourFetch = async function(...args) {
      var response = await originalFetch.apply(this, args);
      // The `active` re-check matters: a request can be in flight when the
      // user presses Stop. Anything that lands after that is dropped.
      if (!active) return response;
      try {
        var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
        if (isInterestingUrl(url)) {
          response.clone().text()
            .then(function(text) { handleBody(url, text); })
            .catch(function() {});
        }
      } catch (_) {}
      return response;
    };
    window.fetch = ourFetch;

    originalXhrOpen = XMLHttpRequest.prototype.open;
    originalXhrSend = XMLHttpRequest.prototype.send;

    ourXhrOpen = function(method, url, ...rest) {
      this.__sbeUrl = url;
      return originalXhrOpen.apply(this, [method, url].concat(rest));
    };
    ourXhrSend = function(...args) {
      this.addEventListener('load', function() {
        if (!active) return;
        try {
          var url = this.__sbeUrl || '';
          if (isInterestingUrl(url)) handleBody(url, this.responseText);
        } catch (_) {}
      });
      return originalXhrSend.apply(this, args);
    };

    XMLHttpRequest.prototype.open = ourXhrOpen;
    XMLHttpRequest.prototype.send = ourXhrSend;

    console.log('[SBE] Capture reader installed');
  }

  function uninstall() {
    // Only restore what is still ours. If the page (or another extension)
    // replaced fetch/XHR after us, putting our saved original back would
    // clobber their wrapper — so we leave theirs alone. Either way `active`
    // is false by now, which makes our wrapper inert.
    if (ourFetch && window.fetch === ourFetch) {
      window.fetch = originalFetch;
    }
    if (ourXhrOpen && XMLHttpRequest.prototype.open === ourXhrOpen) {
      XMLHttpRequest.prototype.open = originalXhrOpen;
    }
    if (ourXhrSend && XMLHttpRequest.prototype.send === ourXhrSend) {
      XMLHttpRequest.prototype.send = originalXhrSend;
    }
    ourFetch = null;
    ourXhrOpen = null;
    ourXhrSend = null;
    originalFetch = null;
    originalXhrOpen = null;
    originalXhrSend = null;
    console.log('[SBE] Capture reader removed');
  }

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.type !== CONTROL_TYPE) return;
    if (data.action === 'start') {
      active = true;
      install();
    } else if (data.action === 'stop') {
      active = false;
      uninstall();
    }
  });

  // Test seam: only fires when tests set __SBE_TEST_HOOKS__ before loading
  // the source. Has no effect in the browser.
  if (globalThis.__SBE_TEST_HOOKS__) {
    globalThis.__SBE_TEST_HOOKS__['capture-hook'] = {
      extractCaption: extractCaption,
      extractOwner: extractOwner,
      extractTakenAt: extractTakenAt,
      extractLikeCount: extractLikeCount,
      buildContext: buildContext,
      extractMediaFromData: extractMediaFromData,
      isInterestingUrl: isInterestingUrl,
      install: install,
      uninstall: uninstall,
      MAX_DEPTH: MAX_DEPTH,
      MAX_RESULTS_PER_RESPONSE: MAX_RESULTS_PER_RESPONSE,
      CONTROL_TYPE: CONTROL_TYPE,
      MEDIA_TYPE: MEDIA_TYPE,
      get active() { return active; },
      get installed() { return !!ourFetch; }
    };
  }

})();
