/**
 * Instagram Saved Media Exporter - Content Script
 * Detects and categorizes saved posts as videos, images, or carousels
 * Uses API response interception for reliable media extraction
 */

(function() {
  'use strict';

  // Prevent double injection
  if (window.__igExporterInjected) return;
  window.__igExporterInjected = true;

  console.log('[IG Exporter] v3.0 Content script loaded - with API interception');

  // ============================================
  // STATE
  // ============================================
  
  const state = {
    posts: new Map(),        // shortcode -> post data
    images: [],              // collected image URLs
    videos: [],              // collected video URLs
    carousels: [],           // collected carousel data
    isAnalyzing: false,
    panelVisible: false,
    seenImageUrls: new Set(),   // deduplication
    seenVideoUrls: new Set()    // deduplication
  };

  // ============================================
  // API RESPONSE INTERCEPTION
  // ============================================

  /**
   * Parse media item from Instagram API response
   * Handles: media_type 1 (image), 2 (video), 8 (carousel)
   */
  function parseMediaItem(item, parentItem = null, carouselIndex = null) {
    const results = [];
    
    const user = item.user || parentItem?.user;
    const username = user?.username;
    const userFullName = user?.full_name;
    const userIsVerified = user?.is_verified;
    const userFollowersCount = user?.follower_count;
    const caption = item.caption?.text || parentItem?.caption?.text;
    const likeCount = item.like_count || parentItem?.like_count;
    const commentCount = item.comment_count || parentItem?.comment_count;
    const takenAt = item.taken_at || parentItem?.taken_at;
    const isCarousel = parentItem?.media_type === 8 || false;
    const shortcode = item.code || parentItem?.code;
    const postUrl = shortcode ? `https://www.instagram.com/p/${shortcode}/` : null;
    const scrapedAt = new Date().toISOString();
    
    // Format taken_at as ISO string
    let takenAtStr = '';
    let filename = '';
    if (username && takenAt) {
      const date = new Date(takenAt * 1000);
      takenAtStr = date.toISOString();
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;
      filename = `${username}_${dateStr}`;
    }

    // Handle VIDEO (media_type === 2)
    if (item.media_type === 2 && Array.isArray(item.video_versions) && item.video_versions.length > 0) {
      const videoUrl = item.video_versions[0].url;
      
      if (!state.seenVideoUrls.has(videoUrl)) {
        let thumbnail = '';
        if (item.image_versions2?.candidates?.length > 0) {
          thumbnail = item.image_versions2.candidates[0].url;
        }
        
        results.push({
          type: 'video',
          url: videoUrl,
          postId: shortcode,
          thumbnail: thumbnail,
          filename: filename,
          username: username,
          postUrl: postUrl,
          caption: caption,
          likeCount: likeCount,
          commentCount: commentCount,
          takenAt: takenAtStr,
          mediaType: 'video',
          isCarousel: isCarousel,
          carouselIndex: carouselIndex,
          userFullName: userFullName,
          userIsVerified: userIsVerified,
          userFollowersCount: userFollowersCount,
          scrapedAt: scrapedAt
        });
        
        state.seenVideoUrls.add(videoUrl);
        console.log('[IG Exporter] Captured video:', videoUrl.substring(0, 80) + '...');
      }
    }
    
    // Handle IMAGE (media_type === 1)
    if (item.media_type === 1 && item.image_versions2?.candidates?.length > 0) {
      const imageUrl = item.image_versions2.candidates[0].url;
      
      if (!state.seenImageUrls.has(imageUrl)) {
        results.push({
          type: 'image',
          url: imageUrl,
          postId: shortcode,
          filename: filename,
          username: username,
          postUrl: postUrl,
          caption: caption,
          likeCount: likeCount,
          commentCount: commentCount,
          takenAt: takenAtStr,
          mediaType: 'image',
          isCarousel: isCarousel,
          carouselIndex: carouselIndex,
          userFullName: userFullName,
          userIsVerified: userIsVerified,
          userFollowersCount: userFollowersCount,
          scrapedAt: scrapedAt
        });
        
        state.seenImageUrls.add(imageUrl);
        console.log('[IG Exporter] Captured image:', imageUrl.substring(0, 80) + '...');
      }
    }
    
    return results;
  }

  /**
   * Parse a full media object (handles carousels)
   */
  function parseMediaObject(media) {
    const results = [];
    
    // Handle CAROUSEL (media_type === 8)
    if (media.media_type === 8 && media.carousel_media && media.carousel_media.length > 0) {
      console.log('[IG Exporter] Processing carousel with', media.carousel_media.length, 'items');
      for (let i = 0; i < media.carousel_media.length; i++) {
        results.push(...parseMediaItem(media.carousel_media[i], media, i + 1));
      }
    } else {
      // Single image or video
      results.push(...parseMediaItem(media));
    }
    
    return results;
  }

  /**
   * Process API response data looking for media
   */
  function processApiResponse(data) {
    if (!data || typeof data !== 'object') return;
    
    let mediaItems = [];
    
    // Different API response structures
    // 1. Saved posts: data.items[]
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach(item => {
        if (item.media) {
          mediaItems.push(item.media);
        } else if (item.media_type) {
          mediaItems.push(item);
        }
      });
    }
    
    // 2. Single post: data.graphql.shortcode_media or data.items[0]
    if (data.graphql?.shortcode_media) {
      mediaItems.push(data.graphql.shortcode_media);
    }
    
    // 3. User feed / timeline
    if (data.feed_items) {
      data.feed_items.forEach(item => {
        if (item.media_or_ad) mediaItems.push(item.media_or_ad);
      });
    }
    
    // 4. Reels tray
    if (data.reels_media) {
      data.reels_media.forEach(reel => {
        if (reel.items) {
          reel.items.forEach(item => mediaItems.push(item));
        }
      });
    }
    
    // 5. XDT (newer format)
    if (data.xdt_api__v1__feed__saved__GET_connection?.edges) {
      data.xdt_api__v1__feed__saved__GET_connection.edges.forEach(edge => {
        if (edge.node?.media) mediaItems.push(edge.node.media);
      });
    }
    
    // 6. Direct media array at root
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (item.media_type) mediaItems.push(item);
      });
    }
    
    // Process all found media
    let newCount = 0;
    mediaItems.forEach(media => {
      const parsed = parseMediaObject(media);
      parsed.forEach(item => {
        if (item.type === 'video') {
          state.videos.push(item);
          newCount++;
        } else if (item.type === 'image') {
          state.images.push(item);
          newCount++;
        }
      });
    });
    
    if (newCount > 0) {
      console.log(`[IG Exporter] Captured ${newCount} new items. Total: ${state.images.length} images, ${state.videos.length} videos`);
      updatePanel();
      saveToStorage();
    }
  }

  /**
   * Intercept fetch requests
   */
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    // Clone response to read it
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    
    // Check if this is an Instagram API request we care about
    if (url.includes('/api/v1/') || url.includes('graphql') || url.includes('/web/')) {
      try {
        const clonedResponse = response.clone();
        clonedResponse.json().then(data => {
          processApiResponse(data);
        }).catch(() => {});
      } catch (e) {}
    }
    
    return response;
  };

  /**
   * Intercept XHR requests
   */
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._igExporterUrl = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      const url = this._igExporterUrl || '';
      if (url.includes('/api/v1/') || url.includes('graphql') || url.includes('/web/')) {
        try {
          const data = JSON.parse(this.responseText);
          processApiResponse(data);
        } catch (e) {}
      }
    });
    return originalXHRSend.apply(this, args);
  };

  console.log('[IG Exporter] API interception active');

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
        type: 'video',
        postId: shortcodeInfo.code,
        shortcode: shortcodeInfo.code,
        thumbnail: thumbnailUrl,
        url: null, // Will be fetched or captured via API interception
        postUrl: `https://www.instagram.com/${shortcodeInfo.type}/${shortcodeInfo.code}/`,
        scrapedAt: new Date().toISOString()
      };
      state.videos.push(videoData);
      
      // Fetch actual video URL as fallback (API interception is preferred)
      fetchVideoUrl(shortcodeInfo.code, shortcodeInfo.type);
      
    } else if (type === 'carousel') {
      state.carousels.push({
        type: 'carousel',
        postId: shortcodeInfo.code,
        shortcode: shortcodeInfo.code,
        thumbnail: thumbnailUrl,
        postUrl: `https://www.instagram.com/p/${shortcodeInfo.code}/`,
        scrapedAt: new Date().toISOString()
      });
      // For carousels, also try to fetch all media
      fetchCarouselMedia(shortcodeInfo.code);
      
    } else {
      if (thumbnailUrl && !state.seenImageUrls.has(thumbnailUrl)) {
        state.images.push({
          type: 'image',
          postId: shortcodeInfo.code,
          shortcode: shortcodeInfo.code,
          url: thumbnailUrl,
          postUrl: `https://www.instagram.com/p/${shortcodeInfo.code}/`,
          scrapedAt: new Date().toISOString()
        });
        state.seenImageUrls.add(thumbnailUrl);
      }
    }
    
    return postData;
  }

  // Track fetched posts
  const fetchedShortcodes = new Set();
  const videoUrls = new Map(); // shortcode -> videoUrl

  /**
   * Fetch actual video URL using multiple methods
   */
  function fetchVideoUrl(shortcode, postType) {
    if (fetchedShortcodes.has(shortcode)) return;
    fetchedShortcodes.add(shortcode);
    
    console.log('[IG Exporter] Fetching video URL for:', shortcode, postType);
    
    // Method 1: Try embed page
    const embedUrl = `https://www.instagram.com/${postType}/${shortcode}/embed/`;
    
    fetch(embedUrl, { credentials: 'include' })
      .then(res => res.text())
      .then(html => {
        const url = extractVideoUrlFromHtml(html);
        if (url) {
          console.log('[IG Exporter] Got video URL from embed:', shortcode);
          videoUrls.set(shortcode, url);
          updateVideoInState(shortcode, url);
          return;
        }
        
        // Method 2: Try the post page directly
        return tryPostPage(shortcode, postType);
      })
      .catch(err => {
        console.log('[IG Exporter] Embed fetch failed for', shortcode, '- trying post page');
        tryPostPage(shortcode, postType);
      });
  }

  function tryPostPage(shortcode, postType) {
    const postUrl = `https://www.instagram.com/${postType}/${shortcode}/`;
    
    return fetch(postUrl, { credentials: 'include' })
      .then(res => res.text())
      .then(html => {
        const url = extractVideoUrlFromHtml(html);
        if (url) {
          console.log('[IG Exporter] Got video URL from post page:', shortcode);
          videoUrls.set(shortcode, url);
          updateVideoInState(shortcode, url);
        } else {
          console.log('[IG Exporter] No video URL found for:', shortcode);
        }
      })
      .catch(err => {
        console.log('[IG Exporter] Post page fetch failed for', shortcode);
      });
  }

  function extractVideoUrlFromHtml(html) {
    if (!html) return null;
    
    // Pattern 1: video_url in JSON
    const patterns = [
      /"video_url"\s*:\s*"([^"]+)"/g,
      /"contentUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/g,
      /video_url=([^&"]+)/g,
      /src="(https?:\/\/[^"]+\.mp4[^"]*)"/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const url = decodeVideoUrl(match[1]);
        if (url && isValidVideoUrl(url)) {
          return url;
        }
      }
    }
    
    // Pattern 2: Find any .mp4 URL
    const mp4Matches = html.match(/https?:[^"'\s\\<>]+\.mp4[^"'\s\\<>]*/g);
    if (mp4Matches) {
      for (const url of mp4Matches) {
        const decoded = decodeVideoUrl(url);
        if (decoded && isValidVideoUrl(decoded)) {
          return decoded;
        }
      }
    }
    
    // Pattern 3: Look for video CDN URLs (Instagram uses specific patterns)
    const cdnPatterns = [
      /https?:\/\/[^"'\s]+(?:instagram|fbcdn)[^"'\s]+\/v\/[^"'\s]+/g,
      /https?:\/\/[^"'\s]+\/o1\/v\/[^"'\s]+/g
    ];
    
    for (const pattern of cdnPatterns) {
      const match = html.match(pattern);
      if (match) {
        const decoded = decodeVideoUrl(match[0]);
        if (decoded && isValidVideoUrl(decoded)) {
          return decoded;
        }
      }
    }
    
    return null;
  }

  function isValidVideoUrl(url) {
    if (!url) return false;
    // Check for Instagram/Facebook CDN
    return (url.includes('instagram') || url.includes('fbcdn') || url.includes('cdninstagram')) &&
           (url.includes('.mp4') || url.includes('/v/') || url.includes('/video'));
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
    const video = state.videos.find(v => v.shortcode === shortcode || v.postId === shortcode);
    if (video && !video.url) {
      video.url = videoUrl;
      state.seenVideoUrls.add(videoUrl);
      console.log('[IG Exporter] Updated video URL for:', shortcode);
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
    const headers = [
      'Type', 'Post ID', 'Post URL', 'Media URL', 'Thumbnail', 'Username', 
      'User Full Name', 'Caption', 'Like Count', 'Comment Count', 
      'Taken At', 'Is Carousel', 'Carousel Index', 'Scraped At'
    ];
    let csv = headers.join(',') + '\n';
    
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""').replace(/\n/g, ' ');
      return str.includes(',') || str.includes('"') ? `"${str}"` : str;
    };
    
    state.images.forEach(item => {
      csv += [
        'image', escapeCSV(item.postId), escapeCSV(item.postUrl), escapeCSV(item.url), '',
        escapeCSV(item.username), escapeCSV(item.userFullName), escapeCSV(item.caption),
        item.likeCount || '', item.commentCount || '', escapeCSV(item.takenAt),
        item.isCarousel || false, item.carouselIndex || '', escapeCSV(item.scrapedAt)
      ].join(',') + '\n';
    });
    
    state.videos.forEach(item => {
      csv += [
        'video', escapeCSV(item.postId), escapeCSV(item.postUrl), escapeCSV(item.url), 
        escapeCSV(item.thumbnail), escapeCSV(item.username), escapeCSV(item.userFullName),
        escapeCSV(item.caption), item.likeCount || '', item.commentCount || '', 
        escapeCSV(item.takenAt), item.isCarousel || false, item.carouselIndex || '', 
        escapeCSV(item.scrapedAt)
      ].join(',') + '\n';
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
    
    // Collect actual video URLs (direct CDN URLs, not post URLs)
    const videoUrlList = state.videos.map(v => v.url).filter(Boolean);
    
    // Collect actual image URLs
    const imageUrlList = state.images.map(i => i.url).filter(Boolean);
    
    // Save full data for export
    // Also save URL arrays for gallery compatibility
    chrome.storage.local.set({
      igExporterData: data,
      imageUrls: imageUrlList,
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
        
        // Rebuild seen URLs for deduplication
        state.images.forEach(item => {
          if (item.url) state.seenImageUrls.add(item.url);
          if (item.shortcode) state.posts.set(item.shortcode, item);
          if (item.postId) state.posts.set(item.postId, item);
        });
        state.videos.forEach(item => {
          if (item.url) state.seenVideoUrls.add(item.url);
          if (item.shortcode) state.posts.set(item.shortcode, item);
          if (item.postId) state.posts.set(item.postId, item);
        });
        state.carousels.forEach(item => {
          if (item.shortcode) state.posts.set(item.shortcode, item);
        });
        
        updatePanel();
        console.log('[IG Exporter] Loaded from storage:', state.images.length, 'images,', state.videos.length, 'videos');
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
