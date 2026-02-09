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
  // LISTEN FOR MEDIA FROM INJECTOR (runs in MAIN world)
  // ============================================
  
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data?.type !== 'IG_EXPORTER_MEDIA') return;
    
    const media = event.data.media || [];
    console.log('[IG Exporter] Received', media.length, 'media from API interceptor');
    
    let added = 0;
    media.forEach(item => {
      if (item.type === 'video' && item.url) {
        if (addVideo(item.url, null, item.thumbnail)) added++;
      } else if (item.type === 'image' && item.url) {
        if (addImage(item.url, null, item.url)) added++;
      }
    });
    
    if (added > 0) {
      console.log('[IG Exporter] Added', added, 'new items from API');
      updatePanel();
      saveToStorage();
    }
  });

  // ============================================
  // STATE
  // ============================================
  
  const state = {
    images: [],
    videos: [],
    carousels: [],
    seenUrls: new Set(),
    capturedShortcodes: new Set(),  // Track which posts we've already captured
    selectedShortcodes: new Set(),  // Track selected posts for capture
    selectionMode: false            // Whether selection mode is active
  };
  
  // ============================================
  // SELECTION MODE (iPhone-style checkboxes)
  // ============================================
  
  function injectSelectionStyles() {
    if (document.getElementById('ig-exporter-selection-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ig-exporter-selection-styles';
    style.textContent = `
      .ig-exporter-checkbox {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(0,0,0,0.5);
        border: 2px solid white;
        cursor: pointer;
        z-index: 100;
        display: none;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }
      .ig-exporter-checkbox:hover {
        transform: scale(1.1);
      }
      .ig-exporter-checkbox.checked {
        background: linear-gradient(135deg, #E1306C, #833ab4);
        border-color: #E1306C;
      }
      .ig-exporter-checkbox.checked::after {
        content: '✓';
        color: white;
        font-size: 14px;
        font-weight: bold;
      }
      .ig-exporter-selection-active .ig-exporter-checkbox {
        display: flex !important;
      }
      .ig-exporter-selection-bar {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        border: 1px solid #E1306C;
        border-radius: 12px;
        padding: 12px 20px;
        display: flex;
        gap: 12px;
        align-items: center;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .ig-exporter-selection-bar button {
        padding: 8px 16px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.15s ease;
      }
      .ig-exporter-selection-bar .primary {
        background: linear-gradient(135deg, #E1306C, #833ab4);
        color: white;
      }
      .ig-exporter-selection-bar .primary:hover {
        opacity: 0.9;
      }
      .ig-exporter-selection-bar .secondary {
        background: #2a2a4a;
        color: white;
        border: 1px solid #444;
      }
      .ig-exporter-selection-bar .secondary:hover {
        border-color: #E1306C;
      }
      .ig-exporter-selection-bar .count {
        color: #E1306C;
        font-size: 14px;
        font-weight: 600;
        min-width: 80px;
      }
    `;
    document.head.appendChild(style);
  }
  
  function addCheckboxesToPosts() {
    const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
    const processed = new Set();
    
    links.forEach(link => {
      const match = link.href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
      if (!match) return;
      
      const shortcode = match[2];
      if (processed.has(shortcode)) return;
      processed.add(shortcode);
      
      // Find the container (usually the parent div with position relative)
      let container = link;
      while (container && container.tagName !== 'ARTICLE') {
        const style = window.getComputedStyle(container);
        if (style.position === 'relative' || style.position === 'absolute') {
          break;
        }
        container = container.parentElement;
      }
      
      if (!container) container = link;
      
      // Check if checkbox already exists
      if (container.querySelector('.ig-exporter-checkbox')) return;
      
      // Make container relative if needed
      const containerStyle = window.getComputedStyle(container);
      if (containerStyle.position === 'static') {
        container.style.position = 'relative';
      }
      
      // Create checkbox
      const checkbox = document.createElement('div');
      checkbox.className = 'ig-exporter-checkbox';
      checkbox.dataset.shortcode = shortcode;
      
      if (state.selectedShortcodes.has(shortcode)) {
        checkbox.classList.add('checked');
      }
      
      checkbox.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSelection(shortcode, checkbox);
      });
      
      container.appendChild(checkbox);
    });
  }
  
  function toggleSelection(shortcode, checkbox) {
    if (state.selectedShortcodes.has(shortcode)) {
      state.selectedShortcodes.delete(shortcode);
      checkbox.classList.remove('checked');
    } else {
      state.selectedShortcodes.add(shortcode);
      checkbox.classList.add('checked');
    }
    updateSelectionBar();
  }
  
  function selectAll() {
    const checkboxes = document.querySelectorAll('.ig-exporter-checkbox');
    checkboxes.forEach(cb => {
      const shortcode = cb.dataset.shortcode;
      if (shortcode) {
        state.selectedShortcodes.add(shortcode);
        cb.classList.add('checked');
      }
    });
    updateSelectionBar();
    console.log('[IG Exporter] Selected all:', state.selectedShortcodes.size, 'posts');
  }
  
  function deselectAll() {
    state.selectedShortcodes.clear();
    const checkboxes = document.querySelectorAll('.ig-exporter-checkbox');
    checkboxes.forEach(cb => {
      cb.classList.remove('checked');
    });
    updateSelectionBar();
    console.log('[IG Exporter] Deselected all');
  }
  
  let selectionBar = null;
  
  function createSelectionBar() {
    if (selectionBar) return;
    
    selectionBar = document.createElement('div');
    selectionBar.className = 'ig-exporter-selection-bar';
    selectionBar.innerHTML = `
      <span class="count"><span id="ig-sel-count">0</span> selected</span>
      <button class="secondary" id="ig-select-all">Select All</button>
      <button class="secondary" id="ig-deselect-all">Deselect All</button>
      <button class="primary" id="ig-capture-selected">Capture Selected</button>
      <button class="secondary" id="ig-exit-selection">Exit</button>
    `;
    document.body.appendChild(selectionBar);
    
    document.getElementById('ig-select-all').onclick = selectAll;
    document.getElementById('ig-deselect-all').onclick = deselectAll;
    document.getElementById('ig-capture-selected').onclick = captureSelected;
    document.getElementById('ig-exit-selection').onclick = exitSelectionMode;
  }
  
  function updateSelectionBar() {
    const countEl = document.getElementById('ig-sel-count');
    if (countEl) {
      countEl.textContent = state.selectedShortcodes.size;
    }
  }
  
  function enterSelectionMode() {
    state.selectionMode = true;
    injectSelectionStyles();
    document.body.classList.add('ig-exporter-selection-active');
    addCheckboxesToPosts();
    createSelectionBar();
    updateSelectionBar();
    
    // Watch for new posts being loaded (infinite scroll)
    startSelectionObserver();
    
    console.log('[IG Exporter] Selection mode activated');
  }
  
  function exitSelectionMode() {
    state.selectionMode = false;
    document.body.classList.remove('ig-exporter-selection-active');
    
    if (selectionBar) {
      selectionBar.remove();
      selectionBar = null;
    }
    
    stopSelectionObserver();
    console.log('[IG Exporter] Selection mode deactivated');
  }
  
  let selectionObserver = null;
  
  function startSelectionObserver() {
    if (selectionObserver) return;
    
    selectionObserver = new MutationObserver(() => {
      if (state.selectionMode) {
        addCheckboxesToPosts();
      }
    });
    
    selectionObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  function stopSelectionObserver() {
    if (selectionObserver) {
      selectionObserver.disconnect();
      selectionObserver = null;
    }
  }
  
  async function captureSelected() {
    console.log('[IG Exporter] captureSelected() called');
    
    if (state.selectedShortcodes.size === 0) {
      alert('No posts selected. Tap on posts to select them.');
      return;
    }
    
    // IMPORTANT: Save selection to local variable BEFORE exiting selection mode
    const selectedList = Array.from(state.selectedShortcodes);
    console.log('[IG Exporter] === CAPTURE SELECTED MODE ===');
    console.log('[IG Exporter] Selected count:', selectedList.length);
    console.log('[IG Exporter] Selected shortcodes:', selectedList);
    
    exitSelectionMode();
    
    // Clear selection now (we have a copy)
    state.selectedShortcodes.clear();
    
    // Start capture with ONLY selected shortcodes
    console.log('[IG Exporter] Calling startAutoClickCapture with selection...');
    await startAutoClickCapture(selectedList);
  }
  
  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  // Normalize URL by removing query params (for deduplication)
  function normalizeUrl(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      // Return just the path without query params
      return parsed.origin + parsed.pathname;
    } catch (e) {
      // If URL parsing fails, return as-is
      return url;
    }
  }

  function addImage(url, postUrl, thumbnail) {
    if (!url) return false;
    
    // Use normalized URL for duplicate check
    const normalizedUrl = normalizeUrl(url);
    if (state.seenUrls.has(normalizedUrl)) return false;
    state.seenUrls.add(normalizedUrl);
    
    state.images.push({
      type: 'image',
      url: url,  // Store original URL with params
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
    if (!key) return false;
    
    // Use normalized URL for duplicate check
    const normalizedKey = normalizeUrl(key);
    if (state.seenUrls.has(normalizedKey)) return false;
    state.seenUrls.add(normalizedKey);
    
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
  // CAROUSEL DETECTION HELPERS
  // ============================================

  // Recursively search for carousel_media in any object
  function findCarouselMedia(obj, depth = 0) {
    if (depth > 10 || !obj || typeof obj !== 'object') return null;
    
    // Direct carousel_media
    if (Array.isArray(obj.carousel_media) && obj.carousel_media.length > 0) {
      return obj.carousel_media;
    }
    
    // GraphQL edge_sidecar_to_children
    if (obj.edge_sidecar_to_children?.edges?.length > 0) {
      return obj.edge_sidecar_to_children.edges.map(e => e.node);
    }
    
    // Search in arrays
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findCarouselMedia(item, depth + 1);
        if (found) return found;
      }
    }
    
    // Search in object properties
    for (const key of Object.keys(obj)) {
      if (key === 'carousel_media' && Array.isArray(obj[key]) && obj[key].length > 0) {
        return obj[key];
      }
      const found = findCarouselMedia(obj[key], depth + 1);
      if (found) return found;
    }
    
    return null;
  }

  // ============================================
  // FETCH INDIVIDUAL POSTS
  // ============================================

  const fetchedCarousels = new Set();

  // Note: Instagram's __a=1 API is blocked (returns 404)
  // Carousel items are captured when user clicks on a post and we intercept the API response
  function markCarouselForCapture(shortcode) {
    if (fetchedCarousels.has(shortcode)) return;
    fetchedCarousels.add(shortcode);
    console.log('[IG Exporter] Carousel detected:', shortcode);
  }

  // ============================================
  // AUTO-CLICK CAROUSEL CAPTURE
  // ============================================

  let autoClickRunning = false;
  let autoClickQueue = [];
  
  function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async function closeModal() {
    // Try different close button selectors
    const closeSelectors = [
      'svg[aria-label="Close"]',
      '[aria-label="Close"]',
      'button[type="button"] svg[aria-label="Close"]',
      'div[role="dialog"] svg[aria-label="Close"]',
      '[aria-label="Close dialog"]'
    ];
    
    for (const selector of closeSelectors) {
      const closeBtn = document.querySelector(selector);
      if (closeBtn) {
        const button = closeBtn.closest('button') || closeBtn.closest('[role="button"]') || closeBtn;
        button.click();
        console.log('[IG Exporter] Closed modal via button');
        await sleep(randomDelay(500, 800));
        return true;
      }
    }
    
    // Try pressing Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    console.log('[IG Exporter] Sent Escape key');
    await sleep(randomDelay(300, 500));
    
    // Check if we're on a post page (not the saved posts page)
    // If so, go back
    if (window.location.pathname.includes('/p/') || window.location.pathname.includes('/reel/')) {
      console.log('[IG Exporter] On post page, going back to saved posts');
      window.history.back();
      await sleep(randomDelay(1000, 1500));
    }
    
    return true;
  }
  
  async function clickCarouselPost(link, shortcode) {
    console.log('[IG Exporter] Auto-clicking carousel:', shortcode);
    
    // Scroll element into view naturally
    link.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(randomDelay(400, 800));
    
    // Click the post - use a simulated click that should open modal
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    link.dispatchEvent(clickEvent);
    
    // Wait for modal to open
    await sleep(randomDelay(1500, 2500));
    
    // Wait for modal to appear - try multiple times
    let modal = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      modal = document.querySelector('div[role="dialog"]') || 
              document.querySelector('article[role="presentation"]') ||
              document.querySelector('div[class*="Modal"]');
      if (modal) break;
      await sleep(300);
    }
    
    if (!modal) {
      console.log('[IG Exporter] Modal still not found after waiting, trying to continue anyway');
    }
    
    // Navigate through carousel slides to trigger loading of all items
    const nextBtnSelectors = [
      'button[aria-label="Next"]',
      'div[aria-label="Next"]',
      '[aria-label="Next"]',
      'button[aria-label="Go to next slide"]',
      'button[aria-label="Go forward"]',
      // SVG-based next buttons
      'button svg[aria-label="Right chevron icon"]',
      'div[role="button"] svg[aria-label="Right chevron icon"]'
    ];
    
    let slideCount = 0;
    const maxSlides = 10;
    
    while (slideCount < maxSlides) {
      let foundNext = false;
      for (const selector of nextBtnSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          // Find the clickable element
          const clickable = el.closest('button') || el.closest('[role="button"]') || el.closest('div[tabindex]') || el;
          
          if (clickable && typeof clickable.click === 'function') {
            try {
              clickable.click();
              await sleep(randomDelay(500, 900));
              slideCount++;
              foundNext = true;
              
              // Capture the current slide's image
              captureModalImages(shortcode);
              
              console.log('[IG Exporter] Clicked next slide', slideCount);
              break;
            } catch (e) {
              console.log('[IG Exporter] Click failed:', e.message);
            }
          }
        }
      }
      if (!foundNext) break;
    }
    
    console.log('[IG Exporter] Navigated through', slideCount, 'slides');
    
    // Wait a bit more for any final API calls
    await sleep(randomDelay(500, 1000));
    
    // Capture images from the modal DOM (fallback if API doesn't provide carousel_media)
    const modalImages = captureModalImages(shortcode);
    console.log('[IG Exporter] Captured', modalImages, 'images from modal');
    
    // Close the modal
    await closeModal();
    
    // Random delay before next action (human-like)
    await sleep(randomDelay(800, 1500));
  }
  
  async function startAutoClickCapture(selectedOnly = null) {
    if (autoClickRunning) {
      console.log('[IG Exporter] Auto-click already running');
      return;
    }
    
    autoClickRunning = true;
    const isSelectionMode = selectedOnly && Array.isArray(selectedOnly) && selectedOnly.length > 0;
    const modeLabel = isSelectionMode ? 'SELECTED ONLY' : 'ALL POSTS';
    
    console.log('[IG Exporter] ========================================');
    console.log('[IG Exporter] MODE:', modeLabel);
    if (isSelectionMode) {
      console.log('[IG Exporter] Selected shortcodes to capture:', selectedOnly);
    }
    console.log('[IG Exporter] ========================================');
    
    setStatus(`Capturing ${modeLabel.toLowerCase()}...`);
    
    // Find all unique posts (deduplicate by shortcode)
    const seenShortcodes = new Set();
    const carouselLinks = [];
    const allLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
    console.log('[IG Exporter] Total <a> elements found:', allLinks.length);
    
    // If we have a selection filter, create a Set for quick lookup
    const selectionFilter = isSelectionMode ? new Set(selectedOnly) : null;
    console.log('[IG Exporter] Selection filter:', selectionFilter ? `${selectionFilter.size} items: [${Array.from(selectionFilter).join(', ')}]` : 'NONE (capture all)');
    
    allLinks.forEach(link => {
      const href = link.href;
      if (!href) return;
      
      const match = href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
      if (!match) return;
      const shortcode = match[2];
      
      // If we have a selection filter, skip posts that aren't selected
      if (selectionFilter && !selectionFilter.has(shortcode)) {
        return; // Skip - not in selection
      }
      
      // Skip if we already have this shortcode (in this scan - prevents clicking same post twice)
      if (seenShortcodes.has(shortcode)) return;
      seenShortcodes.add(shortcode);
      
      // Check for carousel indicator - multiple methods
      let isCarousel = false;
      
      // Method 1: SVG with Carousel aria-label
      const hasCarouselLabel = link.querySelector('[aria-label*="Carousel"]') ||
                               link.closest('div')?.querySelector('[aria-label*="Carousel"]');
      if (hasCarouselLabel) isCarousel = true;
      
      // Method 2: Multiple images indicator (stacked squares icon)
      const container = link.closest('div');
      if (container) {
        const svgs = container.querySelectorAll('svg');
        svgs.forEach(svg => {
          const paths = svg.querySelectorAll('path');
          paths.forEach(path => {
            const d = path.getAttribute('d') || '';
            // Common carousel icon patterns
            if ((d.includes('M19') && d.includes('M3')) ||
                (d.includes('M22') && d.includes('rect')) ||
                (d.length > 80 && d.split('M').length >= 2)) {
              isCarousel = true;
            }
          });
        });
      }
      
      // Get visual position for sorting
      const rect = link.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      // Capture posts
      carouselLinks.push({ 
        link, 
        shortcode, 
        isCarousel,
        top: rect.top + scrollTop,  // Absolute position on page
        left: rect.left + scrollLeft
      });
    });
    
    // Sort by visual position: top to bottom, then left to right
    carouselLinks.sort((a, b) => {
      // Group by rows (items within 50px of each other are on same row)
      const rowDiff = Math.abs(a.top - b.top);
      if (rowDiff < 50) {
        return a.left - b.left;  // Same row: sort by left position
      }
      return a.top - b.top;  // Different rows: sort by top position
    });
    
    console.log('[IG Exporter] Posts to capture:', carouselLinks.length, 
                '| Carousels:', carouselLinks.filter(c => c.isCarousel).length);
    if (carouselLinks.length > 0) {
      console.log('[IG Exporter] Posts list:', carouselLinks.map(c => c.shortcode).join(', '));
    }
    console.log('[IG Exporter] First post:', carouselLinks[0]?.shortcode, 'at top:', Math.round(carouselLinks[0]?.top));
    setStatus(`Found ${carouselLinks.length} posts to capture`);
    
    // Safety check: if selection filter was provided but no posts matched, something's wrong
    if (selectionFilter && carouselLinks.length === 0) {
      console.log('[IG Exporter] WARNING: Selection filter has items but no posts matched. Filter contents:', Array.from(selectionFilter));
    }
    if (selectionFilter && carouselLinks.length > selectionFilter.size) {
      console.log('[IG Exporter] WARNING: More posts than selection! This should not happen.');
    }
    
    // Process each post - find element fresh each time to avoid stale references
    for (let i = 0; i < carouselLinks.length; i++) {
      if (!autoClickRunning) {
        console.log('[IG Exporter] Auto-click stopped by user');
        break;
      }
      
      const { shortcode, top } = carouselLinks[i];
      setStatus(`Capturing ${i + 1}/${carouselLinks.length}...`);
      
      // Wait for the saved posts page to be ready (if we navigated back)
      let pageReady = false;
      for (let attempt = 0; attempt < 10 && !pageReady; attempt++) {
        // Check if we're on the saved posts page
        if (window.location.pathname.includes('/saved/')) {
          pageReady = true;
        } else {
          console.log('[IG Exporter] Waiting for saved posts page... attempt', attempt + 1);
          await sleep(300);
        }
      }
      
      // Find the element fresh each time (DOM may have changed)
      let freshLink = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        freshLink = document.querySelector(`a[href*="/p/${shortcode}"], a[href*="/reel/${shortcode}"]`);
        if (freshLink) break;
        
        console.log('[IG Exporter] Element not found for:', shortcode, '- attempt', attempt + 1);
        
        // Try scrolling to approximate position
        window.scrollTo({ top: Math.max(0, top - 300), behavior: 'instant' });
        await sleep(500);
        
        // Also try scrolling up first if we're deep in the page
        if (attempt >= 2) {
          window.scrollTo({ top: 0, behavior: 'instant' });
          await sleep(300);
          window.scrollTo({ top: Math.max(0, top - 300), behavior: 'instant' });
          await sleep(500);
        }
      }
      
      if (!freshLink) {
        console.log('[IG Exporter] Could not find element after 5 attempts, skipping:', shortcode);
        continue;
      }
      
      try {
        await clickCarouselPost(freshLink, shortcode);
      } catch (error) {
        console.log('[IG Exporter] Error clicking carousel:', error.message);
      }
      
      // Random delay between posts (2-5 seconds to be safe)
      if (i < carouselLinks.length - 1) {
        const delay = randomDelay(2000, 5000);
        console.log('[IG Exporter] Waiting', delay, 'ms before next...');
        await sleep(delay);
      }
    }
    
    autoClickRunning = false;
    const newCount = carouselLinks.length;
    setStatus(`Done! Processed ${newCount} posts`);
    console.log('[IG Exporter] Auto-click capture complete. Total captured shortcodes:', state.capturedShortcodes.size);
    saveToStorage();
  }
  
  function stopAutoClickCapture() {
    autoClickRunning = false;
    setStatus('Stopped');
    console.log('[IG Exporter] Auto-click stopped');
  }
  
  // Capture images from currently open modal - only the centered carousel image
  function captureModalImages(shortcode) {
    let count = 0;
    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
    
    // Find the modal or post article
    let modal = document.querySelector('div[role="dialog"]');
    
    // If no modal, we might be on the post page directly - look for the article
    if (!modal) {
      modal = document.querySelector('article[role="presentation"]') ||
              document.querySelector('article') ||
              document.querySelector('main');
    }
    
    if (!modal) {
      console.log('[IG Exporter] Modal/article not found!');
      return 0;
    }
    
    console.log('[IG Exporter] Found container:', modal.tagName, modal.getAttribute('role'));
    
    // Get modal center
    const modalRect = modal.getBoundingClientRect();
    const modalCenterX = modalRect.left + modalRect.width / 2;
    const modalCenterY = modalRect.top + modalRect.height / 2;
    console.log('[IG Exporter] Modal center:', Math.round(modalCenterX), Math.round(modalCenterY));
    
    // Look for images in the modal - try broader selector
    let images = modal.querySelectorAll('img[src*="cdninstagram"], img[src*="fbcdn"]');
    console.log('[IG Exporter] Images found with CDN selector:', images.length);
    
    // If no images found, try all images
    if (images.length === 0) {
      images = modal.querySelectorAll('img');
      console.log('[IG Exporter] All images in modal:', images.length);
    }
    
    // Find the image that is closest to the center of the modal AND large
    let mainImage = null;
    let minDistanceToCenter = Infinity;
    
    images.forEach(img => {
      const src = img.src;
      if (!src) return;
      
      // Skip profile pics, small thumbnails
      if (src.includes('profile') || src.includes('44x44') || src.includes('150x150') || src.includes('240x240')) {
        return;
      }
      
      const rect = img.getBoundingClientRect();
      console.log('[IG Exporter] Image:', rect.width, 'x', rect.height, 'src:', src.substring(0, 50));
      
      // Must be reasonably large (at least 100x100 - lowered threshold)
      if (rect.width < 100 || rect.height < 100) {
        console.log('[IG Exporter] Skipped - too small');
        return;
      }
      
      // Calculate distance from image center to modal center
      const imgCenterX = rect.left + rect.width / 2;
      const imgCenterY = rect.top + rect.height / 2;
      const distance = Math.sqrt(
        Math.pow(imgCenterX - modalCenterX, 2) + 
        Math.pow(imgCenterY - modalCenterY, 2)
      );
      
      console.log('[IG Exporter] Distance to center:', Math.round(distance));
      
      // Find the most centered large image
      if (distance < minDistanceToCenter) {
        minDistanceToCenter = distance;
        mainImage = img;
      }
    });
    
    console.log('[IG Exporter] Main image found:', !!mainImage);
    
    // Capture the main centered image
    if (mainImage) {
      let bestUrl = mainImage.src;
      
      // Get best quality from srcset
      if (mainImage.srcset) {
        const parts = mainImage.srcset.split(',');
        let maxWidth = 0;
        parts.forEach(part => {
          const match = part.trim().match(/^(\S+)\s+(\d+)w$/);
          if (match && parseInt(match[2]) > maxWidth) {
            maxWidth = parseInt(match[2]);
            bestUrl = match[1];
          }
        });
      }
      
      if (addImage(bestUrl, postUrl, bestUrl)) {
        console.log('[IG Exporter] Captured modal image:', bestUrl.substring(0, 60));
        count++;
      }
    }
    
    // Also look for videos - capture ANY video with a valid src
    const videos = modal.querySelectorAll('video');
    console.log('[IG Exporter] Videos found in modal:', videos.length);
    
    videos.forEach(video => {
      const src = video.src;
      const poster = video.poster;
      
      // Skip blob URLs (they won't work in gallery)
      if (src && src.startsWith('blob:')) {
        console.log('[IG Exporter] Skipping blob video');
        return;
      }
      
      // Need either a direct CDN URL or a poster
      if (src && (src.includes('cdninstagram') || src.includes('fbcdn'))) {
        if (addVideo(src, postUrl, poster)) {
          console.log('[IG Exporter] Captured modal video:', src.substring(0, 60));
          count++;
        }
      } else if (poster) {
        // Video might not have loaded yet, but we have poster
        console.log('[IG Exporter] Video without direct URL, checking poster');
      }
    });
    
    if (count > 0) {
      updatePanel();
      saveToStorage();
    }
    
    return count;
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
        const carouselItems = item.carousel_media || [];
        console.log('[IG Exporter] Found carousel:', { 
          shortcode, 
          itemCount: carouselItems.length,
          hasCarouselMedia: !!item.carousel_media 
        });
        
        if (carouselItems.length > 0) {
          carouselItems.forEach((carouselItem, idx) => {
            parseMedia(carouselItem, shortcode, idx + 1);
          });
        } else {
          // Carousel detected but no items in API response
          // User needs to click on the post to capture all images
          markCarouselForCapture(shortcode);
          // Still add the thumbnail as fallback
          if (imageUrl) {
            if (addImage(imageUrl, postUrl, imageUrl)) count++;
          }
        }
        return;
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
      const isRelevantUrl = url.includes('/api/') || 
                            url.includes('graphql') || 
                            url.includes('/saved') || 
                            url.includes('/feed/') || 
                            url.includes('/media/') ||
                            url.includes('/info/') ||
                            url.includes('/web_info') ||
                            url.includes('/p/') ||
                            url.includes('/reel/') ||
                            url.includes('query');
      
      if (isRelevantUrl) {
        console.log('[IG Exporter] Intercepted fetch:', url.substring(0, 150));
        
        const cloned = response.clone();
        cloned.text().then(text => {
          try {
            const data = JSON.parse(text);
            
            // Deep search for carousel_media in the response
            const carouselData = findCarouselMedia(data);
            if (carouselData) {
              console.log('[IG Exporter] CAROUSEL DATA FOUND!', carouselData.length, 'items');
              carouselData.forEach((item, idx) => {
                const imageUrl = item.image_versions2?.candidates?.[0]?.url;
                const videoUrl = item.video_versions?.[0]?.url;
                const postUrl = window.location.href.includes('/p/') ? window.location.href : null;
                
                if (item.media_type === 2 && videoUrl) {
                  addVideo(videoUrl, postUrl, imageUrl);
                } else if (imageUrl) {
                  addImage(imageUrl, postUrl, imageUrl);
                }
              });
              updatePanel();
              saveToStorage();
            }
            
            const count = parseApiResponse(data);
            if (count > 0) {
              console.log('[IG Exporter] Parsed', count, 'new items from API');
              updatePanel();
              saveToStorage();
            }
          } catch (e) {
            // Not JSON, ignore
          }
        }).catch(() => {});
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
        if (url.includes('/api/') || url.includes('graphql') || url.includes('/saved') || 
            url.includes('/feed/') || url.includes('/media/') || url.includes('/p/') || 
            url.includes('/reel/') || url.includes('/info')) {
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
    
    // Find post links and detect carousels
    document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').forEach(link => {
      const href = link.href;
      if (!href) return;
      
      // Extract shortcode
      const match = href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
      if (!match) return;
      const shortcode = match[2];
      
      // Check for carousel indicator (multiple items icon)
      const hasCarouselIcon = link.querySelector('svg[aria-label*="Carousel"]') ||
                              link.querySelector('[aria-label*="Carousel"]') ||
                              link.parentElement?.querySelector('svg[aria-label*="Carousel"]');
      
      // Also check for the stacked squares icon (carousel indicator)
      const svgs = link.querySelectorAll('svg');
      let isCarousel = hasCarouselIcon;
      svgs.forEach(svg => {
        const path = svg.querySelector('path');
        if (path) {
          const d = path.getAttribute('d') || '';
          // Carousel icon typically has a specific pattern
          if (d.includes('M19') && d.includes('M3') && d.length > 100) {
            isCarousel = true;
          }
        }
      });
      
      if (isCarousel && !fetchedCarousels.has(shortcode)) {
        markCarouselForCapture(shortcode);
      }
    });
    
    // Legacy: Find post links (for posts we haven't captured yet)
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
        <button id="ig-exp-scroll" class="ig-exp-btn">📜 Auto Scroll</button>
        <button id="ig-exp-carousels" class="ig-exp-btn-primary">🎠 Capture Carousels</button>
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
    
    panel.querySelector('#ig-exp-scroll').onclick = toggleAutoScroll;
    
    const carouselBtn = panel.querySelector('#ig-exp-carousels');
    carouselBtn.onclick = () => {
      if (autoClickRunning) {
        stopAutoClickCapture();
        carouselBtn.textContent = '🎠 Capture Carousels';
      } else {
        startAutoClickCapture();
        carouselBtn.textContent = '⏹️ Stop Capture';
      }
    };
    
    panel.querySelector('#ig-exp-gallery').onclick = () => {
      chrome.runtime.sendMessage({ type: 'OPEN_GALLERY' });
    };
    
    panel.querySelector('#ig-exp-clear').onclick = () => {
      state.images = [];
      state.videos = [];
      state.carousels = [];
      state.seenUrls.clear();
      state.capturedShortcodes.clear();
      updatePanel();
      saveToStorage();
      setStatus('Cleared!');
    };
  }

  function updatePanel() {
    // No floating panel - stats are in popup
    console.log('[IG Exporter] Stats:', state.images.length, 'images,', state.videos.length, 'videos');
  }

  function setStatus(msg) {
    // No floating panel - log to console
    console.log('[IG Exporter]', msg);
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
        
        // Rebuild seenUrls from loaded data (using normalized URLs)
        state.images.forEach(i => { 
          if (i.url) state.seenUrls.add(normalizeUrl(i.url));
        });
        state.videos.forEach(v => { 
          if (v.url) state.seenUrls.add(normalizeUrl(v.url));
          if (v.postUrl) state.seenUrls.add(normalizeUrl(v.postUrl));
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
        
      case 'START_CAROUSELS':
        startAutoClickCapture();
        sendResponse({
          images: state.images.length,
          videos: state.videos.length
        });
        break;
        
      case 'STOP_CAROUSELS':
        stopAutoClickCapture();
        sendResponse({ ok: true });
        break;
        
      case 'CLEAR':
        console.log('[IG Exporter] CLEAR command received - clearing ALL data');
        state.images = [];
        state.videos = [];
        state.carousels = [];
        state.seenUrls.clear();
        state.capturedShortcodes.clear();
        updatePanel();
        chrome.storage.local.set({
          igExporterData: { images: [], videos: [], carousels: [] },
          imageUrls: [],
          videoUrls: []
        });
        sendResponse({ ok: true });
        break;
        
      case 'CAPTURE_CAROUSELS':
        if (autoClickRunning) {
          stopAutoClickCapture();
        } else {
          startAutoClickCapture();
        }
        sendResponse({ ok: true, running: autoClickRunning });
        break;
        
      case 'TOGGLE_SELECTION_MODE':
        if (state.selectionMode) {
          exitSelectionMode();
        } else {
          enterSelectionMode();
        }
        sendResponse({ ok: true, selectionMode: state.selectionMode });
        break;
        
      case 'GET_SELECTION_COUNT':
        sendResponse({ count: state.selectedShortcodes.size, selectionMode: state.selectionMode });
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
    console.log('[IG Exporter] Ready. Click extension icon to use.');
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

})();
