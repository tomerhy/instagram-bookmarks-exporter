/**
 * Instagram API Interceptor - Runs in page's MAIN world
 * Intercepts fetch/XHR to capture video URLs from API responses
 */

(function() {
  if (window.__igExporterApiInjected) return;
  window.__igExporterApiInjected = true;
  
  console.log('[IG Exporter] API interceptor active in page context');

  // Pull post-level metadata from a media object. Different API shapes
  // (REST v1, GraphQL, XDT) put the same data under different keys.
  function extractCaption(data) {
    if (!data) return null;
    if (data.caption && typeof data.caption === 'object' && typeof data.caption.text === 'string') return data.caption.text;
    if (typeof data.caption === 'string') return data.caption;
    if (data.edge_media_to_caption?.edges?.[0]?.node?.text) return data.edge_media_to_caption.edges[0].node.text;
    return null;
  }
  function extractOwner(data) {
    if (!data) return null;
    return data.user?.username || data.owner?.username || null;
  }
  function extractTakenAt(data) {
    if (!data) return null;
    const ts = (typeof data.taken_at === 'number') ? data.taken_at
             : (typeof data.taken_at_timestamp === 'number') ? data.taken_at_timestamp
             : null;
    return ts ? new Date(ts * 1000).toISOString() : null;
  }
  function extractLikeCount(data) {
    if (!data) return null;
    if (typeof data.like_count === 'number') return data.like_count;
    if (typeof data.edge_media_preview_like?.count === 'number') return data.edge_media_preview_like.count;
    return null;
  }

  // Build a context (post-level metadata) when the current node looks like a
  // post root. Carousel children inherit the parent's context but get their own
  // carouselIndex.
  function buildContext(data) {
    const shortcode = data.code || data.shortcode || null;
    if (!shortcode) return null;
    let carouselSize = 1;
    if (Array.isArray(data.carousel_media)) carouselSize = data.carousel_media.length;
    else if (Array.isArray(data.edge_sidecar_to_children?.edges)) carouselSize = data.edge_sidecar_to_children.edges.length;
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

  // Walk an arbitrary API response and pull out media URLs + their post context.
  // parentCtx flows down so carousel children carry the parent post's metadata.
  function extractMediaFromData(data, depth = 0, parentCtx = null) {
    if (depth > 15 || !data || typeof data !== 'object') return [];
    const results = [];

    // If this node introduces its own shortcode, it becomes the new context.
    const ownCtx = buildContext(data);
    const ctx = ownCtx || parentCtx;

    // Check for video_versions
    if (Array.isArray(data.video_versions) && data.video_versions.length > 0) {
      const videoUrl = data.video_versions[0].url;
      const imageUrl = data.image_versions2?.candidates?.[0]?.url;
      if (videoUrl) {
        results.push({ type: 'video', url: videoUrl, thumbnail: imageUrl, context: ctx });
      }
    }

    // Check for image_versions2 (for images)
    if (data.image_versions2?.candidates?.length > 0 && !data.video_versions) {
      const imageUrl = data.image_versions2.candidates[0].url;
      if (imageUrl && data.media_type === 1) {
        results.push({ type: 'image', url: imageUrl, context: ctx });
      }
    }

    // Carousel children — pass parent ctx with their own index.
    if (Array.isArray(data.carousel_media)) {
      data.carousel_media.forEach((item, idx) => {
        const childCtx = ctx ? Object.assign({}, ctx, { carouselIndex: idx }) : null;
        results.push(...extractMediaFromData(item, depth + 1, childCtx));
      });
    }

    // GraphQL sidecar (carousel)
    if (Array.isArray(data.edge_sidecar_to_children?.edges)) {
      data.edge_sidecar_to_children.edges.forEach((edge, idx) => {
        if (edge.node) {
          const childCtx = ctx ? Object.assign({}, ctx, { carouselIndex: idx }) : null;
          results.push(...extractMediaFromData(edge.node, depth + 1, childCtx));
        }
      });
    }

    // Items array — sibling posts, each may introduce its own context via
    // buildContext on the next recursion. Pass parentCtx (not ctx) on purpose:
    // these are siblings of the current node, not children of it, so they
    // must NOT inherit the current node's post-level metadata. Don't "fix"
    // this to ctx — it would attach the wrong post's caption/owner to siblings
    // that fail to introduce their own shortcode.
    if (Array.isArray(data.items)) {
      data.items.forEach(item => {
        results.push(...extractMediaFromData(item, depth + 1, parentCtx));
      });
    }

    // GraphQL edges — same sibling semantics as `items` above. Pass parentCtx
    // so each edge's node introduces its own context.
    if (Array.isArray(data.edges)) {
      data.edges.forEach(edge => {
        if (edge.node) {
          results.push(...extractMediaFromData(edge.node, depth + 1, parentCtx));
        }
      });
    }

    // Recurse into objects (skip keys we already handled)
    if (typeof data === 'object' && !Array.isArray(data)) {
      const skipKeys = ['video_versions', 'carousel_media', 'items', 'edges', 'image_versions2', 'edge_sidecar_to_children'];
      for (const key of Object.keys(data)) {
        if (!skipKeys.includes(key)) {
          results.push(...extractMediaFromData(data[key], depth + 1, ctx));
        }
      }
    }

    return results;
  }
  
  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      
      if (url.includes('/api/') || url.includes('graphql') || url.includes('/media/') || 
          url.includes('/info') || url.includes('/p/') || url.includes('/reel/')) {
        
        const cloned = response.clone();
        cloned.text().then(text => {
          try {
            const data = JSON.parse(text);
            const media = extractMediaFromData(data);
            
            if (media.length > 0) {
              console.log('[IG Exporter] Intercepted', media.length, 'media from fetch');
              window.postMessage({ type: 'IG_EXPORTER_MEDIA', media: media }, '*');
            }
          } catch (e) {}
        }).catch(() => {});
      }
    } catch (e) {}
    
    return response;
  };
  
  // Intercept XHR
  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._igUrl = url;
    return origXhrOpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      try {
        const url = this._igUrl || '';
        if (url.includes('/api/') || url.includes('graphql') || url.includes('/media/') ||
            url.includes('/info') || url.includes('/p/') || url.includes('/reel/')) {

          const data = JSON.parse(this.responseText);
          const media = extractMediaFromData(data);

          if (media.length > 0) {
            console.log('[IG Exporter] Intercepted', media.length, 'media from XHR');
            window.postMessage({ type: 'IG_EXPORTER_MEDIA', media: media }, '*');
          }
        }
      } catch (e) {}
    });
    return origXhrSend.apply(this, args);
  };

  // Test seam: only fires when tests set __IG_EXPORTER_TEST_HOOKS__ before
  // loading the source. Has no effect in the browser.
  if (typeof globalThis !== 'undefined' && globalThis.__IG_EXPORTER_TEST_HOOKS__) {
    globalThis.__IG_EXPORTER_TEST_HOOKS__.injector = {
      extractCaption, extractOwner, extractTakenAt, extractLikeCount,
      buildContext, extractMediaFromData
    };
  }

})();
