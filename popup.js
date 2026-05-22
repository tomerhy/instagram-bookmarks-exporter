/**
 * Instagram Saved Media Exporter - Popup Script
 */

document.addEventListener('DOMContentLoaded', function() {
  const imagesCount = document.getElementById('images-count');
  const videosCount = document.getElementById('videos-count');
  const statusEl = document.getElementById('status');
  const loadingBar = document.getElementById('loading-bar');
  const mainContent = document.getElementById('main-content');
  const notInstagram = document.getElementById('not-instagram');
  const versionEl = document.getElementById('version');
  
  let isCapturing = false;
  const captureBtn = document.getElementById('capture-btn');
  const autoplayToggle = document.getElementById('autoplay-toggle');
  const supportBanner = document.getElementById('support-banner');
  const supportBtn = document.getElementById('support-btn');
  const dismissBtn = document.getElementById('dismiss-btn');
  const coffeeLink = document.getElementById('coffee-link');

  // Frozen at popup-open time so the "+N new" stat delta compares against the
  // previous engagement, not the current one. Bumping lastSeenAt for the badge
  // happens separately via markSeen() — these two timestamps intentionally
  // diverge while the popup is open.
  let sessionSnapshot = null;

  const COFFEE_URL = 'https://buymeacoffee.com/thyproduction';
  const USE_THRESHOLD = 15;
  
  // Set version
  try {
    versionEl.textContent = 'v' + chrome.runtime.getManifest().version;
  } catch (e) {}
  
  // Track popup page view
  if (window.Analytics) {
    Analytics.trackPageView('popup', 'Extension Popup');
  }
  
  // Support banner logic
  function checkSupportBanner() {
    chrome.storage.local.get(['supportDismissed', 'useCount'], function(result) {
      if (result.supportDismissed) return;
      const useCount = result.useCount || 0;
      if (useCount >= USE_THRESHOLD && supportBanner) {
        supportBanner.classList.add('visible');
      }
    });
  }
  
  function incrementUseCount() {
    chrome.storage.local.get(['useCount'], function(result) {
      const newCount = (result.useCount || 0) + 1;
      chrome.storage.local.set({ useCount: newCount });
    });
  }
  
  function openCoffeeLink() {
    chrome.tabs.create({ url: COFFEE_URL });
    if (window.Analytics) {
      Analytics.trackButtonClick('buy_coffee', 'popup');
    }
  }
  
  function dismissBanner() {
    chrome.storage.local.set({ supportDismissed: true });
    if (supportBanner) supportBanner.classList.remove('visible');
    if (window.Analytics) {
      Analytics.trackButtonClick('dismiss_support', 'popup');
    }
  }
  
  // Support button handlers
  if (supportBtn) {
    supportBtn.addEventListener('click', function() {
      openCoffeeLink();
      dismissBanner();
    });
  }
  
  if (dismissBtn) {
    dismissBtn.addEventListener('click', dismissBanner);
  }

  if (coffeeLink) {
    coffeeLink.addEventListener('click', function(e) {
      e.preventDefault();
      openCoffeeLink();
    });
  }

  // Easter egg: clicking the logo opens an "About the maker" card.
  // Hidden until triggered. Glass overlay over the popup; Esc / × /
  // backdrop click closes.
  const aboutToggle = document.getElementById('about-toggle');
  const aboutOverlay = document.getElementById('about-overlay');
  const aboutClose = document.getElementById('about-close');

  function showAbout() {
    if (!aboutOverlay) return;
    aboutOverlay.hidden = false;
    aboutOverlay.classList.add('visible');
    aboutOverlay.setAttribute('aria-hidden', 'false');
    // Focus the close button so Esc / Tab navigation is obvious.
    if (aboutClose) aboutClose.focus();
    if (window.Analytics) Analytics.trackFeature('about_opened', {});
  }

  function hideAbout() {
    if (!aboutOverlay) return;
    aboutOverlay.classList.remove('visible');
    aboutOverlay.setAttribute('aria-hidden', 'true');
    // Keep `hidden` synced so the dialog is removed from the AT tree when closed.
    aboutOverlay.hidden = true;
    if (aboutToggle) aboutToggle.focus();
  }

  if (aboutToggle) aboutToggle.addEventListener('click', showAbout);
  if (aboutClose)  aboutClose.addEventListener('click', hideAbout);
  if (aboutOverlay) {
    aboutOverlay.addEventListener('click', function (e) {
      // Click on the backdrop (not the card) closes
      if (e.target === aboutOverlay) hideAbout();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && aboutOverlay && aboutOverlay.classList.contains('visible')) {
      hideAbout();
    }
  });

  // Check if banner should show
  checkSupportBanner();

  // Autoplay toggle: load current state, persist on change, push live to active tab.
  if (autoplayToggle) {
    chrome.storage.local.get(['igAutoplayEnabled'], function(result) {
      const enabled = result.igAutoplayEnabled !== false;
      autoplayToggle.checked = enabled;
    });

    autoplayToggle.addEventListener('change', function() {
      const enabled = autoplayToggle.checked;
      chrome.storage.local.set({ igAutoplayEnabled: enabled });
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const tab = tabs[0];
        if (!tab || !tab.id) return;
        chrome.tabs.sendMessage(tab.id, { type: 'SET_AUTOPLAY_ENABLED', enabled: enabled }, function() {
          void chrome.runtime.lastError;
        });
      });
      if (window.Analytics) {
        Analytics.trackButtonClick(enabled ? 'autoplay_on' : 'autoplay_off', 'popup');
      }
    });
  }
  
  function setStatus(msg, capturing = false) {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.classList.toggle('capturing', capturing);
    }
    if (loadingBar) {
      loadingBar.classList.toggle('active', capturing);
    }
  }
  
  function updateStats(stats) {
    const totalImages = stats.images || 0;
    const totalVideos = stats.videos || 0;
    if (imagesCount) imagesCount.textContent = totalImages;
    if (videosCount) videosCount.textContent = totalVideos;
    toggleEmptyState(totalImages + totalVideos === 0);
  }

  function toggleEmptyState(empty) {
    const statsEl = document.getElementById('stats');
    const emptyEl = document.getElementById('stats-empty');
    if (statsEl) statsEl.style.display = empty ? 'none' : '';
    if (emptyEl) emptyEl.classList.toggle('visible', empty);
  }

  // Count how many items have scrapedAt strictly newer than the given timestamp.
  // Mirrors background.js#countUnseen — kept inline to avoid cross-script
  // duplication of state across the popup<->service-worker boundary.
  function countSince(items, ts) {
    if (!ts || !items || !items.length) return 0;
    let n = 0;
    for (const it of items) {
      if (!it || !it.scrapedAt) continue;
      const t = new Date(it.scrapedAt).getTime();
      if (!isNaN(t) && t > ts) n++;
    }
    return n;
  }

  function setDelta(id, n) {
    const el = document.getElementById(id);
    if (!el) return;
    if (n > 0) {
      el.textContent = '+' + n;
      el.classList.add('has-new');
    } else {
      el.textContent = '';
      el.classList.remove('has-new');
    }
  }

  function refreshDeltas(images, videos) {
    if (sessionSnapshot === null) return;
    setDelta('images-delta', countSince(images, sessionSnapshot));
    setDelta('videos-delta', countSince(videos, sessionSnapshot));
  }

  // Authoritative read: pulls counts AND items from storage so the delta
  // can be computed against sessionSnapshot.
  function refreshFromStorage() {
    chrome.storage.local.get(['igExporterData'], function(result) {
      const data = result.igExporterData || { images: [], videos: [] };
      const images = data.images || [];
      const videos = data.videos || [];
      updateStats({ images: images.length, videos: videos.length });
      refreshDeltas(images, videos);
    });
  }
  
  // Inner-HTML helper that keeps the decorative emoji wrapped in an aria-hidden
  // span so screen readers announce just the label, not "carousel horse Capture".
  function setBtnLabel(btn, emoji, text) {
    if (!btn) return;
    btn.innerHTML =
      '<span class="emoji" aria-hidden="true">' + emoji + '</span> ' + text;
  }

  function updateCaptureState(capturing) {
    isCapturing = capturing;
    if (captureBtn) {
      if (capturing) {
        setBtnLabel(captureBtn, '⏹️', 'Stop');
        setStatus('Capturing...', true);
      } else {
        setBtnLabel(captureBtn, '🎠', 'Capture All');
        setStatus('', false);
      }
    }
  }
  
  // Mark the badge as "seen" — counter is now a notification, not an odometer.
  // Bumped on every poll so the badge stays at 0 while the popup is visible
  // even if new items keep streaming in.
  function markSeen() {
    chrome.storage.local.set({ igExporterLastSeenAt: Date.now() });
  }

  // Storage is the source of truth for counts; we hit GET_STATS only for the
  // capture-running flag (which the content script tracks but storage doesn't).
  function loadStats() {
    markSeen();
    refreshFromStorage();

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const tab = tabs[0];
      if (!tab || !tab.id) return;
      chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' }, function(response) {
        void chrome.runtime.lastError;  // squelch "no receiver" off-IG
        if (response && response.isCapturing !== undefined) {
          updateCaptureState(response.isCapturing);
        }
      });
    });
  }
  
  // Send message to content script
  function sendToContent(msg, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const tab = tabs[0];
      if (!tab || !tab.id) {
        setStatus('No active tab');
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, msg, function(response) {
        if (chrome.runtime.lastError) {
          setStatus('Reload Instagram page first');
          return;
        }
        if (callback) callback(response);
      });
    });
  }
  
  // Read the previous "last seen" BEFORE bumping it. The stat-tile "+N new"
  // badge shows what arrived since the last visit; the toolbar badge meanwhile
  // gets cleared via markSeen(). Two different audiences, two clocks.
  chrome.storage.local.get(['igExporterLastSeenAt'], function(result) {
    sessionSnapshot = result.igExporterLastSeenAt || 0;
    markSeen();

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const tab = tabs[0];
      const isInstagram = tab && tab.url && tab.url.includes('instagram.com');

      if (isInstagram) {
        mainContent.style.display = 'block';
        notInstagram.style.display = 'none';
        loadStats();
      } else {
        mainContent.style.display = 'none';
        notInstagram.style.display = 'block';
      }
    });
  });
  
  // Capture All button
  captureBtn.addEventListener('click', function() {
    if (isCapturing) {
      if (window.Analytics) Analytics.trackButtonClick('stop_capture', 'popup');
      sendToContent({ type: 'STOP_CAROUSELS' });
      setBtnLabel(captureBtn, '🎠', 'Capture All');
      isCapturing = false;
      setStatus('Stopped', false);
    } else {
      if (window.Analytics) Analytics.trackButtonClick('start_capture', 'popup');
      incrementUseCount();
      sendToContent({ type: 'START_CAROUSELS' }, function(response) {
        if (response) {
          updateStats(response);
          // Track capture feature usage with stats
          if (window.Analytics) {
            Analytics.trackFeature('capture_started', {
              images_before: response.images || 0,
              videos_before: response.videos || 0
            });
          }
        }
      });
      setBtnLabel(captureBtn, '⏹️', 'Stop');
      isCapturing = true;
      setStatus('Capturing all posts...', true);
    }
  });
  
  // Clear button — wipes all captured data from chrome.storage.local. Writes
  // directly so it works even when no Instagram tab is open (the previous
  // implementation messaged the content script and silently failed when none
  // was reachable). The storage write fans out via chrome.storage.onChanged:
  //   - content.js resets its in-memory state (images, videos, seenUrls...)
  //   - background.js hides the toolbar badge
  //   - gallery.js (if open) re-renders empty
  //   - this popup's own listener updates the visible counter
  document.getElementById('clear-btn').addEventListener('click', function() {
    // Destructive + irreversible — always confirm.
    if (!confirm('Delete all captured images and videos? This cannot be undone.')) {
      return;
    }
    if (window.Analytics) Analytics.trackButtonClick('clear', 'popup');
    chrome.storage.local.set({
      igExporterData: { images: [], videos: [] },
      imageUrls: [],
      videoUrls: []
    }, function() {
      updateStats({ images: 0, videos: 0 });
      setStatus('Cleared!');
      if (window.Analytics) Analytics.trackFeature('data_cleared', { source: 'popup' });
    });
  });
  
  // Gallery button
  document.getElementById('gallery-btn').addEventListener('click', function() {
    if (window.Analytics) Analytics.trackButtonClick('open_gallery', 'popup');
    chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') });
  });
  
  // React to storage changes from any source (gallery clear, content script
  // capture, etc.) so the popup counter never lags the underlying data.
  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area !== 'local') return;
    if (!changes.igExporterData) return;
    const next = changes.igExporterData.newValue;
    const images = (next && next.images) || [];
    const videos = (next && next.videos) || [];
    updateStats({ images: images.length, videos: videos.length });
    refreshDeltas(images, videos);
  });

  // Poll for stats updates
  setInterval(loadStats, 2000);
});
