/**
 * Instagram Video Auto-Play Feature
 * Auto-plays videos when scrolled into view, like Instagram's native behavior
 * 
 * Features:
 * - IntersectionObserver for viewport detection
 * - MutationObserver for lazy-loaded content
 * - Muted by default (browser autoplay policy)
 * - User preference persistence
 * - Manual override support
 */

(function() {
  'use strict';

  // Prevent double injection
  if (window.__igAutoplayInjected) return;
  window.__igAutoplayInjected = true;

  console.log('[IG Autoplay] Auto-play feature loaded');

  // ============================================
  // CONFIGURATION
  // ============================================
  
  const CONFIG = {
    // Visibility threshold to trigger play (0.5 = 50% visible)
    visibilityThreshold: 0.5,
    
    // Debounce delay for performance (ms)
    debounceDelay: 100,
    
    // Default settings
    defaultEnabled: true,
    defaultMuted: true,
    
    // Preload next video when current is this % complete
    preloadThreshold: 0.8,
    
    // CSS class names
    classes: {
      playing: 'ig-autoplay-playing',
      muted: 'ig-autoplay-muted',
      paused: 'ig-autoplay-paused',
      indicator: 'ig-autoplay-indicator'
    }
  };

  // ============================================
  // STATE
  // ============================================
  
  const state = {
    enabled: CONFIG.defaultEnabled,
    muted: CONFIG.defaultMuted,
    videos: new Map(),           // video element -> video state
    manuallyPaused: new Set(),   // videos user manually paused
    currentlyPlaying: null,      // currently playing video element
    observer: null,              // IntersectionObserver instance
    mutationObserver: null       // MutationObserver instance
  };

  // ============================================
  // STYLES
  // ============================================
  
  function injectStyles() {
    if (document.getElementById('ig-autoplay-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ig-autoplay-styles';
    style.textContent = `
      /* Playing indicator */
      .${CONFIG.classes.indicator} {
        position: absolute;
        top: 8px;
        left: 8px;
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 6px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      .${CONFIG.classes.playing} .${CONFIG.classes.indicator} {
        opacity: 1;
      }
      
      .${CONFIG.classes.indicator}::before {
        content: '';
        width: 8px;
        height: 8px;
        background: #4ade80;
        border-radius: 50%;
        animation: ig-autoplay-pulse 1.5s ease-in-out infinite;
      }
      
      @keyframes ig-autoplay-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.8); }
      }
      
      /* Mute button overlay */
      .ig-autoplay-mute-btn {
        position: absolute;
        bottom: 12px;
        right: 12px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: none;
        border-radius: 50%;
        color: #fff;
        font-size: 16px;
        cursor: pointer;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s ease, background 0.2s ease;
      }
      
      .${CONFIG.classes.playing} .ig-autoplay-mute-btn,
      video:hover + .ig-autoplay-mute-btn,
      .ig-autoplay-mute-btn:hover {
        opacity: 1;
      }
      
      .ig-autoplay-mute-btn:hover {
        background: rgba(225, 48, 108, 0.9);
      }
      
      /* Duration overlay */
      .ig-autoplay-duration {
        position: absolute;
        bottom: 12px;
        left: 12px;
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        z-index: 100;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      video:hover ~ .ig-autoplay-duration,
      .${CONFIG.classes.playing} .ig-autoplay-duration {
        opacity: 1;
      }
      
      /* Video container styles */
      .ig-autoplay-container {
        position: relative;
      }
      
      /* Progress bar */
      .ig-autoplay-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: rgba(255, 255, 255, 0.3);
        z-index: 100;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      .${CONFIG.classes.playing} .ig-autoplay-progress,
      video:hover ~ .ig-autoplay-progress {
        opacity: 1;
      }
      
      .ig-autoplay-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #833ab4, #E1306C);
        width: 0%;
        transition: width 0.1s linear;
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function formatDuration(seconds) {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // ============================================
  // VIDEO ELEMENT MANAGEMENT
  // ============================================
  
  function wrapVideoElement(video) {
    // Skip if already wrapped
    if (video.dataset.igAutoplayWrapped) return;
    video.dataset.igAutoplayWrapped = 'true';
    
    // Find or create container
    let container = video.closest('.ig-autoplay-container');
    if (!container) {
      // Check if parent can be used as container
      const parent = video.parentElement;
      if (parent && getComputedStyle(parent).position !== 'static') {
        container = parent;
        container.classList.add('ig-autoplay-container');
      } else {
        // Create wrapper
        container = document.createElement('div');
        container.className = 'ig-autoplay-container';
        container.style.position = 'relative';
        video.parentNode.insertBefore(container, video);
        container.appendChild(video);
      }
    }
    
    // Add playing indicator
    const indicator = document.createElement('div');
    indicator.className = CONFIG.classes.indicator;
    indicator.innerHTML = '<span>Playing</span>';
    container.appendChild(indicator);
    
    // Add mute/unmute button
    const muteBtn = document.createElement('button');
    muteBtn.className = 'ig-autoplay-mute-btn';
    muteBtn.innerHTML = state.muted ? '🔇' : '🔊';
    muteBtn.title = state.muted ? 'Unmute' : 'Mute';
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleMute(video);
      muteBtn.innerHTML = video.muted ? '🔇' : '🔊';
      muteBtn.title = video.muted ? 'Unmute' : 'Mute';
    });
    container.appendChild(muteBtn);
    
    // Add duration display
    const duration = document.createElement('div');
    duration.className = 'ig-autoplay-duration';
    duration.textContent = '0:00';
    container.appendChild(duration);
    
    // Add progress bar
    const progress = document.createElement('div');
    progress.className = 'ig-autoplay-progress';
    progress.innerHTML = '<div class="ig-autoplay-progress-bar"></div>';
    container.appendChild(progress);
    
    // Update duration when metadata loads
    video.addEventListener('loadedmetadata', () => {
      duration.textContent = formatDuration(video.duration);
    });
    
    // Update progress bar
    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        const percent = (video.currentTime / video.duration) * 100;
        const progressBar = progress.querySelector('.ig-autoplay-progress-bar');
        if (progressBar) {
          progressBar.style.width = `${percent}%`;
        }
        
        // Preload next video when approaching end
        if (percent >= CONFIG.preloadThreshold * 100) {
          preloadNextVideo(video);
        }
      }
    });
    
    // Handle manual play/pause
    video.addEventListener('play', () => {
      container.classList.add(CONFIG.classes.playing);
      container.classList.remove(CONFIG.classes.paused);
    });
    
    video.addEventListener('pause', () => {
      container.classList.remove(CONFIG.classes.playing);
      container.classList.add(CONFIG.classes.paused);
    });
    
    // Double-click to toggle mute
    video.addEventListener('dblclick', (e) => {
      e.preventDefault();
      toggleMute(video);
      const btn = container.querySelector('.ig-autoplay-mute-btn');
      if (btn) {
        btn.innerHTML = video.muted ? '🔇' : '🔊';
        btn.title = video.muted ? 'Unmute' : 'Mute';
      }
    });
    
    // Click to toggle play/pause (and track manual pause)
    video.addEventListener('click', (e) => {
      // Let default behavior happen, but track if user manually paused
      if (!video.paused) {
        // User is clicking to pause
        state.manuallyPaused.add(video);
      } else {
        // User is clicking to play
        state.manuallyPaused.delete(video);
      }
    });
    
    // Store video state
    state.videos.set(video, {
      container,
      indicator,
      muteBtn,
      duration,
      progress
    });
    
    console.log('[IG Autoplay] Wrapped video element');
  }

  function toggleMute(video) {
    video.muted = !video.muted;
    state.muted = video.muted;
    
    // Update all video mute states
    state.videos.forEach((_, v) => {
      v.muted = state.muted;
    });
    
    // Save preference
    savePreferences();
  }

  function preloadNextVideo(currentVideo) {
    // Find all observed videos
    const videos = Array.from(state.videos.keys());
    const currentIndex = videos.indexOf(currentVideo);
    
    if (currentIndex >= 0 && currentIndex < videos.length - 1) {
      const nextVideo = videos[currentIndex + 1];
      if (nextVideo.preload === 'none') {
        nextVideo.preload = 'metadata';
        console.log('[IG Autoplay] Preloading next video');
      }
    }
  }

  // ============================================
  // PLAYBACK CONTROL
  // ============================================
  
  async function playVideo(video) {
    if (!state.enabled) return;
    if (state.manuallyPaused.has(video)) return;
    if (state.currentlyPlaying === video && !video.paused) return;
    
    // Pause currently playing video
    if (state.currentlyPlaying && state.currentlyPlaying !== video) {
      pauseVideo(state.currentlyPlaying);
    }
    
    // Set muted state (required for autoplay in most browsers)
    video.muted = state.muted;
    
    try {
      // Attempt to play
      await video.play();
      state.currentlyPlaying = video;
      
      const videoState = state.videos.get(video);
      if (videoState?.container) {
        videoState.container.classList.add(CONFIG.classes.playing);
      }
      
      console.log('[IG Autoplay] Playing video');
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        // Autoplay was blocked - this is expected if not muted
        console.log('[IG Autoplay] Autoplay blocked - ensure video is muted');
        
        // Try again with mute
        if (!video.muted) {
          video.muted = true;
          state.muted = true;
          try {
            await video.play();
            state.currentlyPlaying = video;
          } catch (e) {
            console.log('[IG Autoplay] Autoplay still blocked');
          }
        }
      } else if (error.name === 'AbortError') {
        // Play was interrupted - this is normal during scrolling
        console.log('[IG Autoplay] Play interrupted');
      } else {
        console.error('[IG Autoplay] Play error:', error);
      }
    }
  }

  function pauseVideo(video) {
    if (video && !video.paused) {
      video.pause();
      
      if (state.currentlyPlaying === video) {
        state.currentlyPlaying = null;
      }
      
      const videoState = state.videos.get(video);
      if (videoState?.container) {
        videoState.container.classList.remove(CONFIG.classes.playing);
      }
    }
  }

  function pauseAllVideos() {
    state.videos.forEach((_, video) => {
      pauseVideo(video);
    });
    state.currentlyPlaying = null;
  }

  // ============================================
  // INTERSECTION OBSERVER
  // ============================================
  
  function createIntersectionObserver() {
    if (state.observer) {
      state.observer.disconnect();
    }
    
    const options = {
      root: null, // viewport
      rootMargin: '0px',
      threshold: [0, CONFIG.visibilityThreshold, 1.0]
    };
    
    state.observer = new IntersectionObserver(
      debounce((entries) => {
        if (!state.enabled) return;
        
        let mostVisibleVideo = null;
        let highestRatio = 0;
        
        entries.forEach(entry => {
          const video = entry.target;
          
          if (entry.intersectionRatio >= CONFIG.visibilityThreshold) {
            // Video is visible enough
            if (entry.intersectionRatio > highestRatio) {
              highestRatio = entry.intersectionRatio;
              mostVisibleVideo = video;
            }
          } else {
            // Video is not visible enough - pause it
            if (video === state.currentlyPlaying) {
              pauseVideo(video);
            }
          }
        });
        
        // Play the most visible video
        if (mostVisibleVideo && mostVisibleVideo !== state.currentlyPlaying) {
          playVideo(mostVisibleVideo);
        }
      }, CONFIG.debounceDelay),
      options
    );
    
    console.log('[IG Autoplay] IntersectionObserver created');
  }

  function observeVideo(video) {
    if (!state.observer) {
      createIntersectionObserver();
    }
    
    // Wrap video element with controls
    wrapVideoElement(video);
    
    // Start observing
    state.observer.observe(video);
  }

  function unobserveVideo(video) {
    if (state.observer) {
      state.observer.unobserve(video);
    }
    state.videos.delete(video);
    state.manuallyPaused.delete(video);
  }

  // ============================================
  // MUTATION OBSERVER (for lazy-loaded content)
  // ============================================
  
  function createMutationObserver() {
    if (state.mutationObserver) {
      state.mutationObserver.disconnect();
    }
    
    state.mutationObserver = new MutationObserver(
      debounce((mutations) => {
        mutations.forEach(mutation => {
          // Check added nodes for videos
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if node is a video
              if (node.tagName === 'VIDEO') {
                observeVideo(node);
              }
              // Check for videos within the added node
              const videos = node.querySelectorAll?.('video');
              if (videos) {
                videos.forEach(video => observeVideo(video));
              }
            }
          });
          
          // Handle removed videos
          mutation.removedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === 'VIDEO') {
                unobserveVideo(node);
              }
              const videos = node.querySelectorAll?.('video');
              if (videos) {
                videos.forEach(video => unobserveVideo(video));
              }
            }
          });
        });
      }, CONFIG.debounceDelay)
    );
    
    state.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('[IG Autoplay] MutationObserver created');
  }

  // ============================================
  // INITIALIZATION & PREFERENCES
  // ============================================
  
  function loadPreferences() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['igAutoplayEnabled', 'igAutoplayMuted'], (result) => {
          if (result.igAutoplayEnabled !== undefined) {
            state.enabled = result.igAutoplayEnabled;
          }
          if (result.igAutoplayMuted !== undefined) {
            state.muted = result.igAutoplayMuted;
          }
          console.log('[IG Autoplay] Preferences loaded:', { enabled: state.enabled, muted: state.muted });
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  function savePreferences() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({
        igAutoplayEnabled: state.enabled,
        igAutoplayMuted: state.muted
      });
      console.log('[IG Autoplay] Preferences saved');
    }
  }

  function setEnabled(enabled) {
    state.enabled = enabled;
    savePreferences();
    
    if (!enabled) {
      pauseAllVideos();
    }
    
    console.log('[IG Autoplay] Enabled:', enabled);
  }

  function scanExistingVideos() {
    const videos = document.querySelectorAll('video');
    console.log('[IG Autoplay] Found', videos.length, 'existing videos');
    videos.forEach(video => observeVideo(video));
  }

  async function init() {
    // Check if we're on Instagram saved posts
    const url = window.location.href;
    const isSavedPage = url.includes('/saved') || url.includes('instagram.com');
    
    if (!isSavedPage) {
      console.log('[IG Autoplay] Not on Instagram, skipping initialization');
      return;
    }
    
    console.log('[IG Autoplay] Initializing...');
    
    // Inject styles
    injectStyles();
    
    // Load user preferences
    await loadPreferences();
    
    // Create observers
    createIntersectionObserver();
    createMutationObserver();
    
    // Scan existing videos
    scanExistingVideos();
    
    console.log('[IG Autoplay] Initialization complete');
  }

  // ============================================
  // MESSAGE HANDLING (for popup communication)
  // ============================================
  
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      switch (msg.type) {
        case 'GET_AUTOPLAY_STATE':
          sendResponse({
            enabled: state.enabled,
            muted: state.muted,
            videoCount: state.videos.size,
            currentlyPlaying: state.currentlyPlaying !== null
          });
          break;
          
        case 'SET_AUTOPLAY_ENABLED':
          setEnabled(msg.enabled);
          sendResponse({ ok: true, enabled: state.enabled });
          break;
          
        case 'SET_AUTOPLAY_MUTED':
          state.muted = msg.muted;
          savePreferences();
          // Update all videos
          state.videos.forEach((_, video) => {
            video.muted = state.muted;
          });
          sendResponse({ ok: true, muted: state.muted });
          break;
          
        case 'PAUSE_ALL_VIDEOS':
          pauseAllVideos();
          sendResponse({ ok: true });
          break;
      }
      return true;
    });
  }

  // ============================================
  // CLEANUP
  // ============================================
  
  function cleanup() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    if (state.mutationObserver) {
      state.mutationObserver.disconnect();
      state.mutationObserver = null;
    }
    pauseAllVideos();
    state.videos.clear();
    state.manuallyPaused.clear();
  }

  // Handle page unload
  window.addEventListener('beforeunload', cleanup);

  // Handle visibility change (pause when tab is hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseAllVideos();
    }
  });

  // ============================================
  // EXPOSE API
  // ============================================
  
  window.__igAutoplay = {
    enable: () => setEnabled(true),
    disable: () => setEnabled(false),
    toggle: () => setEnabled(!state.enabled),
    isEnabled: () => state.enabled,
    pauseAll: pauseAllVideos,
    getState: () => ({
      enabled: state.enabled,
      muted: state.muted,
      videoCount: state.videos.size
    })
  };

  // Start
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

})();
