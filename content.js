/**
 * Instagram Saved Media Exporter - Content Script
 * Detects and categorizes saved posts as videos, images, or carousels
 */

(function() {
  'use strict';

  // Prevent double injection
  if (window.__igExporterInjected) return;
  window.__igExporterInjected = true;

  console.log('[IG Exporter] v2.0 Content script loaded');

  // ============================================
  // STATE
  // ============================================
  
  const state = {
    posts: new Map(),        // shortcode -> post data
    images: [],              // collected image URLs
    videos: [],              // collected video URLs
    carousels: [],           // collected carousel data
    isAnalyzing: false,
    panelVisible: false
  };

  // ============================================
  // POST DETECTION LOGIC
  // ============================================

  /**
   * Detect post type from a post element
   * Returns: 'video' | 'image' | 'carousel' | 'unknown'
   */
  function detectPostType(postElement) {
    // Check for video indicator (SVG with video/clip/reel icon)
    const hasVideoIcon = postElement.querySelector([
      'svg[aria-label="Clip"]',
      'svg[aria-label="Reel"]', 
      'svg[aria-label="Video"]',
      '[aria-label="Clip"]',
      '[aria-label="Reel"]'
    ].join(','));
    
    // Check for video element
    const hasVideoElement = postElement.querySelector('video');
    
    // Check for carousel indicators (multiple items indicator)
    const hasCarouselIcon = postElement.querySelector([
      'svg[aria-label="Carousel"]',
      '[aria-label="Carousel"]',
      // Carousel dot indicators
      'div[style*="transform"]' // Carousel slides
    ].join(','));
    
    // Check for multiple images icon (stacked squares)
    const carouselSvg = postElement.querySelector('svg');
    let isCarousel = false;
    if (carouselSvg) {
      const path = carouselSvg.querySelector('path');
      if (path) {
        const d = path.getAttribute('d') || '';
        // Carousel icon has specific path pattern
        if (d.includes('M19') && d.includes('M12') && d.length > 200) {
          isCarousel = true;
        }
      }
    }
    
    // Look for reels link
    const reelLink = postElement.querySelector('a[href*="/reel/"]');
    if (reelLink) {
      return 'video';
    }
    
    // Video detection
    if (hasVideoElement || hasVideoIcon) {
      return 'video';
    }
    
    // Carousel detection
    if (hasCarouselIcon || isCarousel) {
      return 'carousel';
    }
    
    // Default to image
    return 'image';
  }

  /**
   * Extract shortcode from post link
   */
  function extractShortcode(element) {
    const link = element.querySelector('a[href*="/p/"], a[href*="/reel/"]') || 
                 element.closest('a[href*="/p/"], a[href*="/reel/"]');
    if (!link) return null;
    
    const href = link.href || link.getAttribute('href') || '';
    const match = href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
    return match ? { type: match[1], code: match[2], href: href } : null;
  }

  /**
   * Extract media URL from post element
   */
  function extractMediaUrl(element) {
    // Try to get image src
    const img = element.querySelector('img[src*="instagram"], img[src*="cdninstagram"], img[src*="fbcdn"]');
    if (img) {
      // Prefer srcset for higher quality
      const srcset = img.srcset;
      if (srcset) {
        const parts = srcset.split(',');
        let bestUrl = '';
        let bestWidth = 0;
        parts.forEach(part => {
          const match = part.trim().match(/^(\S+)\s+(\d+)w$/);
          if (match && parseInt(match[2]) > bestWidth) {
            bestWidth = parseInt(match[2]);
            bestUrl = match[1];
          }
        });
        if (bestUrl) return bestUrl;
      }
      return img.src;
    }
    
    // Try video poster
    const video = element.querySelector('video');
    if (video && video.poster) {
      return video.poster;
    }
    
    return null;
  }

  /**
   * Analyze a single post element
   */
  function analyzePost(postElement) {
    const shortcodeInfo = extractShortcode(postElement);
    if (!shortcodeInfo) return null;
    
    // Skip if already analyzed
    if (state.posts.has(shortcodeInfo.code)) {
      return state.posts.get(shortcodeInfo.code);
    }
    
    const type = detectPostType(postElement);
    const thumbnailUrl = extractMediaUrl(postElement);
    
    const postData = {
      shortcode: shortcodeInfo.code,
      type: type,
      isReel: shortcodeInfo.type === 'reel',
      url: shortcodeInfo.href,
      thumbnailUrl: thumbnailUrl,
      timestamp: Date.now()
    };
    
    // Store in state
    state.posts.set(shortcodeInfo.code, postData);
    
    // Categorize
    if (type === 'video' || shortcodeInfo.type === 'reel') {
      const videoData = {
        shortcode: shortcodeInfo.code,
        thumbnailUrl: thumbnailUrl,
        videoUrl: null, // Will be fetched
        postUrl: `https://www.instagram.com/${shortcodeInfo.type}/${shortcodeInfo.code}/`
      };
      state.videos.push(videoData);
      
      // Fetch actual video URL
      fetchVideoUrl(shortcodeInfo.code, shortcodeInfo.type);
      
    } else if (type === 'carousel') {
      state.carousels.push({
        shortcode: shortcodeInfo.code,
        thumbnailUrl: thumbnailUrl,
        postUrl: `https://www.instagram.com/p/${shortcodeInfo.code}/`
      });
      // For carousels, also try to fetch all media
      fetchCarouselMedia(shortcodeInfo.code);
      
    } else {
      if (thumbnailUrl) {
        state.images.push({
          shortcode: shortcodeInfo.code,
          imageUrl: thumbnailUrl,
          postUrl: `https://www.instagram.com/p/${shortcodeInfo.code}/`
        });
      }
    }
    
    return postData;
  }

  // Track fetched posts
  const fetchedShortcodes = new Set();
  const videoUrls = new Map(); // shortcode -> videoUrl

  /**
   * Fetch actual video URL from embed page
   */
  function fetchVideoUrl(shortcode, postType) {
    if (fetchedShortcodes.has(shortcode)) return;
    fetchedShortcodes.add(shortcode);
    
    const embedUrl = `https://www.instagram.com/${postType}/${shortcode}/embed/captioned/`;
    
    fetch(embedUrl, { credentials: 'include' })
      .then(res => res.text())
      .then(html => {
        // Pattern 1: video_url in JSON
        const match1 = html.match(/"video_url"\s*:\s*"([^"]+)"/);
        if (match1) {
          const url = decodeVideoUrl(match1[1]);
          if (url) {
            videoUrls.set(shortcode, url);
            console.log('[IG Exporter] Got video URL for', shortcode);
            updateVideoInState(shortcode, url);
            return;
          }
        }
        
        // Pattern 2: contentUrl
        const match2 = html.match(/"contentUrl"\s*:\s*"([^"]+)"/);
        if (match2) {
          const url = decodeVideoUrl(match2[1]);
          if (url && url.includes('.mp4')) {
            videoUrls.set(shortcode, url);
            console.log('[IG Exporter] Got video URL for', shortcode);
            updateVideoInState(shortcode, url);
            return;
          }
        }
        
        // Pattern 3: Direct .mp4 URL
        const mp4Match = html.match(/https?:[^"'\s\\]+\.mp4[^"'\s\\]*/);
        if (mp4Match) {
          const url = decodeVideoUrl(mp4Match[0]);
          if (url) {
            videoUrls.set(shortcode, url);
            console.log('[IG Exporter] Got video URL for', shortcode);
            updateVideoInState(shortcode, url);
          }
        }
      })
      .catch(err => {
        console.log('[IG Exporter] Failed to fetch video for', shortcode);
      });
  }

  function decodeVideoUrl(url) {
    if (!url) return null;
    return url
      .replace(/\\u002F/g, '/')
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/')
      .replace(/\\/g, '');
  }

  function updateVideoInState(shortcode, videoUrl) {
    // Update the video in state
    const video = state.videos.find(v => v.shortcode === shortcode);
    if (video) {
      video.videoUrl = videoUrl;
    }
    
    // Save to storage
    saveToStorage();
  }

  /**
   * Fetch carousel media (gets all images/videos in carousel)
   */
  function fetchCarouselMedia(shortcode) {
    if (fetchedShortcodes.has('carousel_' + shortcode)) return;
    fetchedShortcodes.add('carousel_' + shortcode);
    
    // For carousels, we just use the thumbnail for now
    // Full carousel extraction would require more complex API calls
    console.log('[IG Exporter] Carousel detected:', shortcode);
  }

  /**
   * Scan all visible posts
   */
  function scanPosts() {
    // Find all post containers - Instagram uses links with /p/ or /reel/
    const postLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
    
    let newCount = 0;
    postLinks.forEach(link => {
      // Get the parent container that has the full post UI
      const container = link.closest('div[class*="x1lliihq"]') || link.parentElement;
      if (container && !state.posts.has(extractShortcode(container)?.code)) {
        const result = analyzePost(container);
        if (result) newCount++;
      }
    });
    
    if (newCount > 0) {
      console.log(`[IG Exporter] Found ${newCount} new posts. Total: ${state.images.length} images, ${state.videos.length} videos, ${state.carousels.length} carousels`);
      updatePanel();
      saveToStorage();
    }
    
    return {
      images: state.images.length,
      videos: state.videos.length,
      carousels: state.carousels.length,
      total: state.posts.size
    };
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
        <span class="ig-exp-title">📸 Media Exporter</span>
        <button class="ig-exp-minimize" title="Minimize">−</button>
      </div>
      <div class="ig-exp-content">
        <div class="ig-exp-stats">
          <div class="ig-exp-stat ig-exp-stat-images">
            <span class="ig-exp-count" id="ig-exp-images">0</span>
            <span class="ig-exp-label">Images</span>
          </div>
          <div class="ig-exp-stat ig-exp-stat-videos">
            <span class="ig-exp-count" id="ig-exp-videos">0</span>
            <span class="ig-exp-label">Videos</span>
          </div>
          <div class="ig-exp-stat ig-exp-stat-carousels">
            <span class="ig-exp-count" id="ig-exp-carousels">0</span>
            <span class="ig-exp-label">Carousels</span>
          </div>
        </div>
        <div class="ig-exp-actions">
          <button id="ig-exp-scan" class="ig-exp-btn ig-exp-btn-primary">🔍 Scan Posts</button>
          <button id="ig-exp-scroll" class="ig-exp-btn">📜 Auto Scroll</button>
        </div>
        <div class="ig-exp-actions">
          <button id="ig-exp-export-json" class="ig-exp-btn">📄 Export JSON</button>
          <button id="ig-exp-export-csv" class="ig-exp-btn">📊 Export CSV</button>
        </div>
        <div class="ig-exp-actions">
          <button id="ig-exp-gallery" class="ig-exp-btn ig-exp-btn-secondary">🖼️ Open Gallery</button>
        </div>
        <div class="ig-exp-status" id="ig-exp-status"></div>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event listeners
    panel.querySelector('.ig-exp-minimize').onclick = togglePanel;
    panel.querySelector('#ig-exp-scan').onclick = () => {
      setStatus('Scanning...');
      const results = scanPosts();
      setStatus(`Found ${results.total} posts`);
    };
    panel.querySelector('#ig-exp-scroll').onclick = toggleAutoScroll;
    panel.querySelector('#ig-exp-export-json').onclick = exportJSON;
    panel.querySelector('#ig-exp-export-csv').onclick = exportCSV;
    panel.querySelector('#ig-exp-gallery').onclick = openGallery;
    
    state.panelVisible = true;
  }

  function togglePanel() {
    const panel = document.getElementById('ig-exporter-panel');
    if (!panel) return;
    
    const content = panel.querySelector('.ig-exp-content');
    const btn = panel.querySelector('.ig-exp-minimize');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      btn.textContent = '−';
    } else {
      content.style.display = 'none';
      btn.textContent = '+';
    }
  }

  function updatePanel() {
    const imgEl = document.getElementById('ig-exp-images');
    const vidEl = document.getElementById('ig-exp-videos');
    const carEl = document.getElementById('ig-exp-carousels');
    
    if (imgEl) imgEl.textContent = state.images.length;
    if (vidEl) vidEl.textContent = state.videos.length;
    if (carEl) carEl.textContent = state.carousels.length;
  }

  function setStatus(msg) {
    const el = document.getElementById('ig-exp-status');
    if (el) el.textContent = msg;
  }

  // ============================================
  // AUTO SCROLL
  // ============================================

  let scrollInterval = null;
  let scrolling = false;

  function toggleAutoScroll() {
    const btn = document.getElementById('ig-exp-scroll');
    
    if (scrolling) {
      stopAutoScroll();
      if (btn) btn.textContent = '📜 Auto Scroll';
    } else {
      startAutoScroll();
      if (btn) btn.textContent = '⏹️ Stop Scroll';
    }
  }

  function startAutoScroll() {
    scrolling = true;
    let lastHeight = 0;
    let stableCount = 0;
    
    setStatus('Scrolling...');
    
    scrollInterval = setInterval(() => {
      if (!scrolling) return;
      
      window.scrollTo(0, document.body.scrollHeight);
      scanPosts();
      
      setStatus(`${state.posts.size} posts found...`);
      
      if (document.body.scrollHeight === lastHeight) {
        stableCount++;
        if (stableCount >= 5) {
          stopAutoScroll();
          setStatus(`Done! ${state.posts.size} posts`);
          document.getElementById('ig-exp-scroll').textContent = '📜 Auto Scroll';
        }
      } else {
        stableCount = 0;
        lastHeight = document.body.scrollHeight;
      }
    }, 1500);
  }

  function stopAutoScroll() {
    scrolling = false;
    if (scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
  }

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================

  function exportJSON() {
    const data = {
      exportDate: new Date().toISOString(),
      stats: {
        images: state.images.length,
        videos: state.videos.length,
        carousels: state.carousels.length,
        total: state.posts.size
      },
      images: state.images,
      videos: state.videos,
      carousels: state.carousels
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadFile(blob, `instagram-saved-${Date.now()}.json`);
    setStatus('Exported JSON');
  }

  function exportCSV() {
    let csv = 'Type,Shortcode,URL,Thumbnail\n';
    
    state.images.forEach(item => {
      csv += `image,${item.shortcode},${item.postUrl},${item.imageUrl}\n`;
    });
    
    state.videos.forEach(item => {
      csv += `video,${item.shortcode},${item.postUrl},${item.thumbnailUrl}\n`;
    });
    
    state.carousels.forEach(item => {
      csv += `carousel,${item.shortcode},${item.postUrl},${item.thumbnailUrl}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadFile(blob, `instagram-saved-${Date.now()}.csv`);
    setStatus('Exported CSV');
  }

  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function openGallery() {
    chrome.runtime.sendMessage({ type: 'OPEN_GALLERY' });
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
    
    // Collect actual video URLs (or post URLs as fallback)
    const videoUrlList = state.videos.map(v => v.videoUrl || v.postUrl).filter(Boolean);
    
    // Save full data for export
    // Also save URL arrays for gallery compatibility
    chrome.storage.local.set({
      igExporterData: data,
      imageUrls: state.images.map(i => i.imageUrl).filter(Boolean),
      videoUrls: videoUrlList
    });
    
    console.log('[IG Exporter] Saved:', state.images.length, 'images,', state.videos.length, 'videos');
  }

  function loadFromStorage() {
    chrome.storage.local.get(['igExporterData'], (result) => {
      if (result.igExporterData) {
        state.images = result.igExporterData.images || [];
        state.videos = result.igExporterData.videos || [];
        state.carousels = result.igExporterData.carousels || [];
        
        // Rebuild posts map
        [...state.images, ...state.videos, ...state.carousels].forEach(item => {
          state.posts.set(item.shortcode, item);
        });
        
        updatePanel();
        console.log('[IG Exporter] Loaded from storage:', state.posts.size, 'posts');
      }
    });
  }

  // ============================================
  // MUTATION OBSERVER
  // ============================================

  let scanDebounce = null;
  
  const observer = new MutationObserver((mutations) => {
    // Debounce scans
    if (scanDebounce) clearTimeout(scanDebounce);
    scanDebounce = setTimeout(() => {
      scanPosts();
    }, 500);
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
          carousels: state.carousels.length,
          total: state.posts.size
        });
        break;
      case 'SCAN':
        const results = scanPosts();
        sendResponse(results);
        break;
      case 'START_SCROLL':
        startAutoScroll();
        sendResponse({ ok: true });
        break;
      case 'STOP_SCROLL':
        stopAutoScroll();
        sendResponse({ ok: true });
        break;
      case 'CLEAR':
        state.posts.clear();
        state.images = [];
        state.videos = [];
        state.carousels = [];
        updatePanel();
        chrome.storage.local.remove(['igExporterData', 'imageUrls', 'videoUrls']);
        sendResponse({ ok: true });
        break;
    }
    return true;
  });

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    // Create UI panel
    createPanel();
    
    // Load saved data
    loadFromStorage();
    
    // Start observing DOM changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Initial scan
    setTimeout(scanPosts, 2000);
    
    console.log('[IG Exporter] Initialized');
  }

  // Wait for page to be ready
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

})();
