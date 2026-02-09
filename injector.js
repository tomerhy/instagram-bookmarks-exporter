/**
 * Instagram API Interceptor - Runs in page's MAIN world
 * Intercepts fetch/XHR to capture video URLs from API responses
 */

(function() {
  if (window.__igExporterApiInjected) return;
  window.__igExporterApiInjected = true;
  
  console.log('[IG Exporter] API interceptor active in page context');
  
  // Helper to find video URLs in response
  function extractMediaFromData(data, depth = 0) {
    if (depth > 15 || !data || typeof data !== 'object') return [];
    const results = [];
    
    // Check for video_versions
    if (Array.isArray(data.video_versions) && data.video_versions.length > 0) {
      const videoUrl = data.video_versions[0].url;
      const imageUrl = data.image_versions2?.candidates?.[0]?.url;
      if (videoUrl) {
        results.push({ type: 'video', url: videoUrl, thumbnail: imageUrl });
      }
    }
    
    // Check for image_versions2 (for images)
    if (data.image_versions2?.candidates?.length > 0 && !data.video_versions) {
      const imageUrl = data.image_versions2.candidates[0].url;
      if (imageUrl && data.media_type === 1) {
        results.push({ type: 'image', url: imageUrl });
      }
    }
    
    // Check for carousel_media
    if (Array.isArray(data.carousel_media)) {
      data.carousel_media.forEach(item => {
        results.push(...extractMediaFromData(item, depth + 1));
      });
    }
    
    // Check for items array
    if (Array.isArray(data.items)) {
      data.items.forEach(item => {
        results.push(...extractMediaFromData(item, depth + 1));
      });
    }
    
    // Check for edges (GraphQL format)
    if (Array.isArray(data.edges)) {
      data.edges.forEach(edge => {
        if (edge.node) {
          results.push(...extractMediaFromData(edge.node, depth + 1));
        }
      });
    }
    
    // Recurse into objects (but skip already processed keys)
    if (typeof data === 'object' && !Array.isArray(data)) {
      const skipKeys = ['video_versions', 'carousel_media', 'items', 'edges', 'image_versions2'];
      for (const key of Object.keys(data)) {
        if (!skipKeys.includes(key)) {
          results.push(...extractMediaFromData(data[key], depth + 1));
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
  
})();
