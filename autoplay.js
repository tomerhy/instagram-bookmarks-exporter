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
  
  // No styles needed — autoplay is now a silent, no-UI feature.
  // It plays the most-visible video as the user scrolls Instagram. Visual
  // feedback comes from Instagram's own video player (mute icon, scrubber).
  function injectStyles() { /* intentionally empty */ }

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
    // Skip if already tracked
    if (video.dataset.igAutoplayWrapped) return;
    video.dataset.igAutoplayWrapped = 'true';

    // Preload the next video as the current one approaches end.
    video.addEventListener('timeupdate', () => {
      if (state.currentlyPlaying === video && video.duration &&
          (video.currentTime / video.duration) >= CONFIG.preloadThreshold) {
        preloadNextVideo(video);
      }
    });

    // Track manual play/pause so we don't fight the user.
    video.addEventListener('click', () => {
      if (!video.paused) state.manuallyPaused.add(video);
      else state.manuallyPaused.delete(video);
    });

    // Double-click toggles our muted preference (mirrored to all tracked videos).
    video.addEventListener('dblclick', (e) => {
      e.preventDefault();
      toggleMute(video);
    });

    state.videos.set(video, {});

    if (state.videos.size === 1) {
      console.log('[IG Autoplay] First video tracked. Will auto-play on scroll.');
    }
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
      }
    }
  }

  // ============================================
  // PLAYBACK CONTROL
  // ============================================
  
  let _loggedDisabledHint = false;
  async function playVideo(video) {
    if (!state.enabled) {
      if (!_loggedDisabledHint) {
        _loggedDisabledHint = true;
        console.log('[IG Autoplay] Skipping play — autoplay is disabled. Toggle "🎬 Auto-play videos" in the extension popup to enable.');
      }
      return;
    }
    if (state.manuallyPaused.has(video)) return;
    if (state.currentlyPlaying === video && !video.paused) return;

    // Pause currently playing video
    if (state.currentlyPlaying && state.currentlyPlaying !== video) {
      pauseVideo(state.currentlyPlaying);
    }

    // Set muted state (required for autoplay in most browsers)
    video.muted = state.muted;

    try {
      await video.play();
      state.currentlyPlaying = video;
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        // Autoplay was blocked - try again with mute
        if (!video.muted) {
          video.muted = true;
          state.muted = true;
          try {
            await video.play();
            state.currentlyPlaying = video;
          } catch (e) {
            // Autoplay still blocked - user must interact
          }
        }
      } else if (error.name === 'AbortError') {
        // Play was interrupted - normal during scrolling
      }
    }
  }

  function pauseVideo(video) {
    if (video && !video.paused) {
      video.pause();
      if (state.currentlyPlaying === video) {
        state.currentlyPlaying = null;
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
    
  }

  function observeVideo(video) {
    if (!state.observer) {
      createIntersectionObserver();
    }

    // Wrap video element with controls
    wrapVideoElement(video);

    // Start observing
    state.observer.observe(video);

    // If autoplay is enabled and nothing is playing yet, immediately kick the
    // most-visible video. This handles the race where a video gets added to
    // the DOM after init() (e.g. SPA navigation, lazy-loaded reels feed) and
    // the IntersectionObserver's auto-fire happens to coincide with state
    // transitions in a way that drops the play.
    if (state.enabled && (!state.currentlyPlaying || state.currentlyPlaying.paused)) {
      playMostVisibleVideo();
    }
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
    }
  }

  // Find the tracked video that's most visible in the viewport, if any meets
  // the visibility threshold. Used when autoplay is toggled on so we don't
  // wait for the next scroll event to start the show.
  function playMostVisibleVideo() {
    let best = null;
    let bestRatio = 0;
    state.videos.forEach((_, video) => {
      const rect = video.getBoundingClientRect();
      if (rect.height <= 0) return;
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const visibleRatio = visibleHeight / rect.height;
      if (visibleRatio > bestRatio && visibleRatio >= CONFIG.visibilityThreshold) {
        bestRatio = visibleRatio;
        best = video;
      }
    });
    if (best) playVideo(best);
  }

  function setEnabled(enabled) {
    const wasEnabled = state.enabled;
    state.enabled = enabled;
    savePreferences();
    _loggedDisabledHint = false;

    if (!enabled) {
      pauseAllVideos();
    } else if (!wasEnabled) {
      // Just turned on — kick off the currently most-visible video so it
      // starts playing immediately, without waiting for the next scroll event.
      playMostVisibleVideo();
    }
  }

  function scanExistingVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => observeVideo(video));
  }

  async function init() {
    // Run on any instagram.com page; the IntersectionObserver only fires when
    // there's an actual <video> in the viewport.
    const url = window.location.href;
    if (!url.includes('instagram.com')) return;

    injectStyles();
    await loadPreferences();
    createIntersectionObserver();
    createMutationObserver();
    scanExistingVideos();

    console.log(
      '[IG Autoplay] Active. enabled=' + state.enabled +
      ' muted=' + state.muted +
      ' videosFound=' + state.videos.size +
      '. Run __igAutoplay.getState() in console for live status.'
    );

    // Safety interval: 500ms backstop. Catches races where a video appears in
    // the DOM after the IntersectionObserver's last fire, or where a SPA route
    // change leaves autoplay enabled but with nothing playing despite a
    // visible video. Idempotent — playVideo() is a no-op if the video is
    // already playing or manually paused.
    if (!state.safetyInterval) {
      state.safetyInterval = setInterval(() => {
        // Cheap early-outs first so pages without videos pay almost nothing.
        if (state.videos.size === 0) return;
        if (!state.enabled) return;
        if (state.currentlyPlaying && !state.currentlyPlaying.paused) return;
        playMostVisibleVideo();
      }, 500);
    }
  }

  // ============================================
  // MESSAGE HANDLING (for popup communication)
  // ============================================
  
  // React to preference changes from the popup (or any other context).
  // This keeps every Instagram tab in sync, not just the one popup messaged.
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.igAutoplayEnabled) {
        const enabled = changes.igAutoplayEnabled.newValue !== false;
        if (enabled !== state.enabled) setEnabled(enabled);
      }
      if (changes.igAutoplayMuted) {
        const muted = !!changes.igAutoplayMuted.newValue;
        if (muted !== state.muted) {
          state.muted = muted;
          state.videos.forEach((_, video) => { video.muted = muted; });
        }
      }
    });
  }

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
    if (state.safetyInterval) {
      clearInterval(state.safetyInterval);
      state.safetyInterval = null;
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
