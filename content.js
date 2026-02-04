/**
 * Instagram Saved Media Exporter - Content Script
 * Simplified version focused on reliability
 */

(function() {
  'use strict';

  // Prevent double injection
  if (window.__igExporterInjected) return;
  window.__igExporterInjected = true;

  console.log('[IG Exporter] Content script loaded');

  // ============================================
  // STATE
  // ============================================
  
  const state = {
    images: [],
    videos: [],
    carousels: [],
    seenUrls: new Set()
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  function addImage(url, postUrl, thumbnail) {
    if (!url || state.seenUrls.has(url)) return false;
    state.seenUrls.add(url);
    state.images.push({
      type: 'image',
      url: url,
      thumbnail: thumbnail || url,
      postUrl: postUrl || null,
      scrapedAt: new Date().toISOString()
    });
    console.log('[IG Exporter] Added image:', url.substring(0, 60));
    return true;
  }

  function addVideo(url, postUrl, thumbnail) {
    const videoUrl = url || null;
    const key = videoUrl || postUrl;
    if (!key || state.seenUrls.has(key)) return false;
    state.seenUrls.add(key);
    
    const video = {
      type: 'video',
      url: videoUrl,
      thumbnail: thumbnail || null,
      postUrl: postUrl || null,
      scrapedAt: new Date().toISOString()
    };
    state.videos.push(video);
    
    console.log('[IG Exporter] Added video:', {
      hasDirectUrl: !!videoUrl,
      urlPreview: (videoUrl || postUrl || '').substring(0, 80),
      hasThumbnail: !!thumbnail
    });
    return true;
  }

  // ============================================
  // API RESPONSE PARSING
  // ============================================

  function parseApiResponse(data) {
    if (!data || typeof data !== 'object') return 0;
    
    let count = 0;
    
    // Helper to parse a single media item
    function parseMedia(item, parentCode = null, carouselIndex = null) {
      if (!item) return;
      
      const shortcode = item.code || item.shortcode || parentCode;
      const postUrl = shortcode ? `https://www.instagram.com/p/${shortcode}/` : null;
      
      // Get thumbnail/image from various possible locations
      let imageUrl = null;
      if (item.image_versions2?.candidates?.length > 0) {
        // Get highest quality image
        const candidates = item.image_versions2.candidates;
        imageUrl = candidates[0].url; // First is usually highest quality
      } else if (item.display_url) {
        imageUrl = item.display_url;
      } else if (item.thumbnail_src) {
        imageUrl = item.thumbnail_src;
      } else if (item.display_resources?.length > 0) {
        // Get highest resolution
        imageUrl = item.display_resources[item.display_resources.length - 1].src;
      }
      
      // CAROUSEL (media_type === 8) - process children first
      if (item.media_type === 8) {
        console.log('[IG Exporter] Found carousel with', item.carousel_media?.length || 0, 'items');
        if (item.carousel_media?.length > 0) {
          item.carousel_media.forEach((carouselItem, idx) => {
            parseMedia(carouselItem, shortcode, idx + 1);
          });
        }
        return; // Don't add the carousel itself, only its children
      }
      
      // Edge sidecar (GraphQL carousel format)
      if (item.edge_sidecar_to_children?.edges?.length > 0) {
        console.log('[IG Exporter] Found sidecar with', item.edge_sidecar_to_children.edges.length, 'items');
        item.edge_sidecar_to_children.edges.forEach((edge, idx) => {
          if (edge.node) parseMedia(edge.node, shortcode, idx + 1);
        });
        return;
      }
      
      // VIDEO (media_type === 2 or is_video === true)
      if (item.media_type === 2 || item.is_video === true) {
        let videoUrl = null;
        
        // Try multiple video URL sources
        if (item.video_versions?.length > 0) {
          videoUrl = item.video_versions[0].url;
        } else if (item.video_url) {
          videoUrl = item.video_url;
        } else if (item.video_resources?.length > 0) {
          videoUrl = item.video_resources[0].src;
        }
        
        console.log('[IG Exporter] Found video:', { 
          hasDirectUrl: !!videoUrl,
          carouselIndex,
          shortcode 
        });
        
        if (addVideo(videoUrl, postUrl, imageUrl)) count++;
      }
      // IMAGE (media_type === 1 or just has an image URL)
      else if (item.media_type === 1 || item.is_video === false || imageUrl) {
        if (imageUrl) {
          console.log('[IG Exporter] Found image:', { 
            carouselIndex, 
            shortcode,
            urlPreview: imageUrl.substring(0, 50) 
          });
          if (addImage(imageUrl, postUrl, imageUrl)) count++;
        }
      }
    }
    
    // Try different API response structures
    try {
      // Structure 1: data.items[]
      if (Array.isArray(data.items)) {
        data.items.forEach(item => {
          if (item.media) parseMedia(item.media);
          else if (item.media_type) parseMedia(item);
        });
      }
      
      // Structure 2: data.user.edge_saved_media.edges[]
      if (data.user?.edge_saved_media?.edges) {
        data.user.edge_saved_media.edges.forEach(edge => {
          if (edge.node) {
            const node = edge.node;
            const postUrl = node.shortcode ? `https://www.instagram.com/p/${node.shortcode}/` : null;
            
            if (node.is_video) {
              addVideo(node.video_url, postUrl, node.display_url);
              count++;
            } else {
              if (addImage(node.display_url, postUrl, node.display_url)) count++;
            }
          }
        });
      }
      
      // Structure 3: XDT format
      if (data.xdt_api__v1__feed__saved__GET_connection?.edges) {
        data.xdt_api__v1__feed__saved__GET_connection.edges.forEach(edge => {
          if (edge.node?.media) parseMedia(edge.node.media);
        });
      }
      
      // Structure 4: Direct array
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.media_type) parseMedia(item);
        });
      }
      
      // Structure 5: graphql shortcode_media
      if (data.graphql?.shortcode_media) {
        parseMedia(data.graphql.shortcode_media);
      }
      
      // Structure 6: data.data.xdt_api
      if (data.data?.xdt_api__v1__feed__saved__GET_connection?.edges) {
        data.data.xdt_api__v1__feed__saved__GET_connection.edges.forEach(edge => {
          if (edge.node?.media) parseMedia(edge.node.media);
        });
      }
      
    } catch (e) {
      console.log('[IG Exporter] Parse error:', e.message);
    }
    
    return count;
  }

  // ============================================
  // FETCH/XHR INTERCEPTION
  // ============================================

  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      
      // Check if this is an Instagram API request
      if (url.includes('/api/') || url.includes('graphql') || url.includes('/saved') || url.includes('/feed/')) {
        console.log('[IG Exporter] Intercepted fetch:', url.substring(0, 100));
        
        const cloned = response.clone();
        cloned.json().then(data => {
          console.log('[IG Exporter] API response keys:', Object.keys(data || {}).slice(0, 5));
          const count = parseApiResponse(data);
          console.log('[IG Exporter] Parsed', count, 'new items from API');
          if (count > 0) {
            updatePanel();
            saveToStorage();
          }
        }).catch((e) => {
          console.log('[IG Exporter] JSON parse failed:', e.message);
        });
      }
    } catch (e) {
      console.log('[IG Exporter] Fetch intercept error:', e.message);
    }
    
    return response;
  };

  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    return origXhrOpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      try {
        const url = this._url || '';
        if (url.includes('/api/') || url.includes('graphql') || url.includes('/saved') || url.includes('/feed/')) {
          console.log('[IG Exporter] Intercepted XHR:', url.substring(0, 100));
          const data = JSON.parse(this.responseText);
          console.log('[IG Exporter] XHR response keys:', Object.keys(data || {}).slice(0, 5));
          const count = parseApiResponse(data);
          console.log('[IG Exporter] Parsed', count, 'new items from XHR');
          if (count > 0) {
            updatePanel();
            saveToStorage();
          }
        }
      } catch (e) {}
    });
    return origXhrSend.apply(this, args);
  };

  // ============================================
  // DOM SCANNING (fallback)
  // ============================================

  function scanDom() {
    let count = 0;
    
    // Find all images
    document.querySelectorAll('img[src*="cdninstagram"], img[src*="fbcdn"]').forEach(img => {
      const src = img.src;
      if (src && !src.includes('profile') && !src.includes('44x44') && !src.includes('150x150')) {
        // Try to get higher quality from srcset
        let bestUrl = src;
        if (img.srcset) {
          const parts = img.srcset.split(',');
          let maxWidth = 0;
          parts.forEach(part => {
            const match = part.trim().match(/^(\S+)\s+(\d+)w$/);
            if (match && parseInt(match[2]) > maxWidth) {
              maxWidth = parseInt(match[2]);
              bestUrl = match[1];
            }
          });
        }
        
        // Find post URL
        let postUrl = null;
        const link = img.closest('a[href*="/p/"], a[href*="/reel/"]');
        if (link) {
          postUrl = link.href;
        }
        
        if (addImage(bestUrl, postUrl, bestUrl)) count++;
      }
    });
    
    // Find all videos
    document.querySelectorAll('video').forEach(video => {
      const src = video.src || video.querySelector('source')?.src;
      const poster = video.poster;
      
      let postUrl = null;
      const link = video.closest('a[href*="/p/"], a[href*="/reel/"]') || 
                   video.parentElement?.querySelector('a[href*="/p/"], a[href*="/reel/"]');
      if (link) {
        postUrl = link.href;
      }
      
      if (src || postUrl) {
        if (addVideo(src, postUrl, poster)) count++;
      }
    });
    
    // Find post links (for posts we haven't captured yet)
    document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').forEach(link => {
      const href = link.href;
      if (!href || state.seenUrls.has(href)) return;
      
      // Check if it has a video icon
      const hasVideoIcon = link.querySelector('svg[aria-label*="Clip"], svg[aria-label*="Reel"], svg[aria-label*="Video"]');
      
      // Get thumbnail
      const img = link.querySelector('img');
      const thumbnail = img?.src || null;
      
      if (hasVideoIcon) {
        if (addVideo(null, href, thumbnail)) count++;
      }
    });
    
    return count;
  }

  // ============================================
  // UI PANEL
  // ============================================

  function createPanel() {
    if (document.getElementById('ig-exporter-panel')) return;
    
    const panel = document.createElement('div');
    panel.id = 'ig-exporter-panel';
    panel.innerHTML = `
      <div class="ig-exp-header">
        <span class="ig-exp-title">📸 IG Exporter</span>
        <button class="ig-exp-close" title="Minimize">−</button>
      </div>
      <div class="ig-exp-body">
        <div class="ig-exp-stats">
          <div><span id="ig-exp-images">0</span> Images</div>
          <div><span id="ig-exp-videos">0</span> Videos</div>
        </div>
        <button id="ig-exp-scan" class="ig-exp-btn-primary">🔍 Scan Page</button>
        <button id="ig-exp-scroll" class="ig-exp-btn">📜 Auto Scroll</button>
        <button id="ig-exp-gallery" class="ig-exp-btn">🖼️ Gallery</button>
        <button id="ig-exp-clear" class="ig-exp-btn-danger">🗑️ Clear</button>
        <div id="ig-exp-status" class="ig-exp-status"></div>
      </div>
    `;
    
    // Styles
    const style = document.createElement('style');
    style.textContent = `
      #ig-exporter-panel {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 200px;
        background: #1a1a2e;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        z-index: 999999;
        font-family: -apple-system, sans-serif;
        color: white;
        font-size: 13px;
      }
      .ig-exp-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        border-bottom: 1px solid #333;
      }
      .ig-exp-title { font-weight: 600; }
      .ig-exp-close {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
      }
      .ig-exp-body { padding: 12px; }
      .ig-exp-body.hidden { display: none; }
      .ig-exp-stats {
        display: flex;
        justify-content: space-around;
        margin-bottom: 12px;
        font-size: 14px;
      }
      .ig-exp-stats span {
        font-weight: bold;
        color: #E1306C;
      }
      .ig-exp-btn, .ig-exp-btn-primary, .ig-exp-btn-danger {
        width: 100%;
        padding: 8px;
        margin-bottom: 6px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
      }
      .ig-exp-btn {
        background: #333;
        color: white;
      }
      .ig-exp-btn:hover { background: #444; }
      .ig-exp-btn-primary {
        background: linear-gradient(135deg, #833ab4, #E1306C);
        color: white;
      }
      .ig-exp-btn-danger {
        background: #dc3545;
        color: white;
      }
      .ig-exp-status {
        font-size: 11px;
        color: #888;
        text-align: center;
        min-height: 16px;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(panel);
    
    // Event handlers
    panel.querySelector('.ig-exp-close').onclick = () => {
      panel.querySelector('.ig-exp-body').classList.toggle('hidden');
    };
    
    panel.querySelector('#ig-exp-scan').onclick = () => {
      setStatus('Scanning...');
      const count = scanDom();
      if (count > 0) {
        updatePanel();
        saveToStorage();
      }
      setStatus(`Found ${state.images.length + state.videos.length} items`);
    };
    
    panel.querySelector('#ig-exp-scroll').onclick = toggleAutoScroll;
    
    panel.querySelector('#ig-exp-gallery').onclick = () => {
      chrome.runtime.sendMessage({ type: 'OPEN_GALLERY' });
    };
    
    panel.querySelector('#ig-exp-clear').onclick = () => {
      state.images = [];
      state.videos = [];
      state.carousels = [];
      state.seenUrls.clear();
      updatePanel();
      saveToStorage();
      setStatus('Cleared!');
    };
  }

  function updatePanel() {
    const imgEl = document.getElementById('ig-exp-images');
    const vidEl = document.getElementById('ig-exp-videos');
    if (imgEl) imgEl.textContent = state.images.length;
    if (vidEl) vidEl.textContent = state.videos.length;
  }

  function setStatus(msg) {
    const el = document.getElementById('ig-exp-status');
    if (el) el.textContent = msg;
  }

  // ============================================
  // AUTO SCROLL
  // ============================================

  let scrollInterval = null;
  let isScrolling = false;

  function toggleAutoScroll() {
    const btn = document.getElementById('ig-exp-scroll');
    
    if (isScrolling) {
      isScrolling = false;
      clearInterval(scrollInterval);
      scrollInterval = null;
      if (btn) btn.textContent = '📜 Auto Scroll';
      setStatus('Stopped');
    } else {
      isScrolling = true;
      if (btn) btn.textContent = '⏹️ Stop';
      setStatus('Scrolling...');
      
      let lastHeight = 0;
      let stableCount = 0;
      
      scrollInterval = setInterval(() => {
        if (!isScrolling) return;
        
        window.scrollTo(0, document.body.scrollHeight);
        scanDom();
        updatePanel();
        saveToStorage();
        
        setStatus(`${state.images.length + state.videos.length} items found...`);
        
        if (document.body.scrollHeight === lastHeight) {
          stableCount++;
          if (stableCount >= 5) {
            toggleAutoScroll();
            setStatus(`Done! ${state.images.length + state.videos.length} items`);
          }
        } else {
          stableCount = 0;
          lastHeight = document.body.scrollHeight;
        }
      }, 1500);
    }
  }

  // ============================================
  // STORAGE
  // ============================================

  function saveToStorage() {
    const data = {
      images: state.images,
      videos: state.videos,
      carousels: state.carousels
    };
    
    chrome.storage.local.set({
      igExporterData: data,
      imageUrls: state.images.map(i => i.url).filter(Boolean),
      videoUrls: state.videos.map(v => v.url || v.postUrl).filter(Boolean)
    });
    
    console.log('[IG Exporter] Saved:', state.images.length, 'images,', state.videos.length, 'videos');
  }

  function loadFromStorage() {
    chrome.storage.local.get(['igExporterData'], (result) => {
      if (result.igExporterData) {
        state.images = result.igExporterData.images || [];
        state.videos = result.igExporterData.videos || [];
        state.carousels = result.igExporterData.carousels || [];
        
        // Rebuild seen URLs
        state.images.forEach(i => { if (i.url) state.seenUrls.add(i.url); });
        state.videos.forEach(v => { 
          if (v.url) state.seenUrls.add(v.url);
          if (v.postUrl) state.seenUrls.add(v.postUrl);
        });
        
        updatePanel();
        console.log('[IG Exporter] Loaded:', state.images.length, 'images,', state.videos.length, 'videos');
      }
    });
  }

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
          carousels: state.carousels.length,
          total: state.images.length + state.videos.length + state.carousels.length
        });
        break;
        
      case 'SCAN':
        const count = scanDom();
        if (count > 0) {
          updatePanel();
          saveToStorage();
        }
        sendResponse({
          images: state.images.length,
          videos: state.videos.length,
          carousels: state.carousels.length,
          total: state.images.length + state.videos.length + state.carousels.length
        });
        break;
        
      case 'START_SCROLL':
        if (!isScrolling) toggleAutoScroll();
        sendResponse({ ok: true });
        break;
        
      case 'STOP_SCROLL':
        if (isScrolling) toggleAutoScroll();
        sendResponse({ ok: true });
        break;
        
      case 'CLEAR':
        state.images = [];
        state.videos = [];
        state.carousels = [];
        state.seenUrls.clear();
        updatePanel();
        chrome.storage.local.set({
          igExporterData: { images: [], videos: [], carousels: [] },
          imageUrls: [],
          videoUrls: []
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
    createPanel();
    loadFromStorage();
    
    // Initial scan after page loads
    setTimeout(() => {
      scanDom();
      updatePanel();
      saveToStorage();
    }, 2000);
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

})();
