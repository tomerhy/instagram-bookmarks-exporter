/**
 * Saved Posts Backup & Export - popup script
 *
 * The popup is the only place capture can be started. It owns the first-run
 * disclosure: until the user has read it and pressed "Enable capture", the
 * content script refuses to start (it re-checks the stored consent flag
 * itself, so this UI is a disclosure surface rather than the enforcement
 * point).
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
  }
  
  function dismissBanner() {
    chrome.storage.local.set({ supportDismissed: true });
    if (supportBanner) supportBanner.classList.remove('visible');
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
  }

  function hideAbout(source) {
    if (!aboutOverlay) return;
    aboutOverlay.classList.remove('visible');
    aboutOverlay.setAttribute('aria-hidden', 'true');
    // Keep `hidden` synced so the dialog is removed from the AT tree when closed.
    aboutOverlay.hidden = true;
    if (aboutToggle) aboutToggle.focus();
  }

  if (aboutToggle) aboutToggle.addEventListener('click', showAbout);
  if (aboutClose)  aboutClose.addEventListener('click', function () { hideAbout('button'); });
  if (aboutOverlay) {
    aboutOverlay.addEventListener('click', function (e) {
      // Click on the backdrop (not the card) closes
      if (e.target === aboutOverlay) hideAbout('backdrop');
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && aboutOverlay && aboutOverlay.classList.contains('visible')) {
      hideAbout('escape');
    }
  });

  // Check if banner should show
  checkSupportBanner();

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
  
  // Inner-HTML helper that swaps the SVG icon + label on the capture button.
  // Uses the inline symbol set defined at the top of popup.html, so changes
  // to icon styling apply globally via the .icon class.
  function setBtnLabel(btn, iconId, text) {
    if (!btn) return;
    btn.innerHTML =
      '<svg class="icon" aria-hidden="true"><use href="#' + iconId + '"/></svg> ' + text;
  }

  function updateCaptureState(capturing) {
    isCapturing = capturing;
    if (captureBtn) {
      if (capturing) {
        setBtnLabel(captureBtn, 'i-stop', 'Stop capture');
        setStatus('Capturing your saved posts...', true);
      } else {
        setBtnLabel(captureBtn, 'i-camera', 'Start capture');
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
  
  // ---------------------------------------------------------------------------
  // First-run disclosure
  // ---------------------------------------------------------------------------
  // Shown once, before the first capture ever runs. The consent timestamp is
  // stored in chrome.storage.local under CONSENT_KEY; content.js reads that
  // same key and will not start without it.

  const CONSENT_KEY = 'sbeConsentAcceptedAt';
  const consentOverlay = document.getElementById('consent-overlay');
  const consentAccept = document.getElementById('consent-accept');
  const consentCancel = document.getElementById('consent-cancel');

  function showConsent() {
    if (!consentOverlay) return;
    consentOverlay.hidden = false;
    consentOverlay.classList.add('visible');
    consentOverlay.setAttribute('aria-hidden', 'false');
    if (consentAccept) consentAccept.focus();
  }

  function hideConsent() {
    if (!consentOverlay) return;
    consentOverlay.classList.remove('visible');
    consentOverlay.setAttribute('aria-hidden', 'true');
    consentOverlay.hidden = true;
    if (captureBtn) captureBtn.focus();
  }

  if (consentCancel) {
    consentCancel.addEventListener('click', function() {
      hideConsent();
      setStatus('Capture not started');
    });
  }

  if (consentAccept) {
    consentAccept.addEventListener('click', function() {
      const stamp = {};
      stamp[CONSENT_KEY] = Date.now();
      chrome.storage.local.set(stamp, function() {
        hideConsent();
        beginCapture();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Start / Stop capture
  // ---------------------------------------------------------------------------

  function beginCapture() {
    incrementUseCount();
    sendToContent({ type: 'START_CAPTURE' }, function(response) {
      if (response && response.reason === 'consent_required') {
        // Consent was revoked (data cleared) between the check and the start.
        showConsent();
        return;
      }
      if (!response || !response.ok) {
        setStatus('Could not start — reload the page and try again');
        return;
      }
      updateStats(response);
      setBtnLabel(captureBtn, 'i-stop', 'Stop capture');
      isCapturing = true;
      setStatus('Capturing your saved posts...', true);
    });
  }

  function endCapture() {
    sendToContent({ type: 'STOP_CAPTURE' });
    setBtnLabel(captureBtn, 'i-camera', 'Start capture');
    isCapturing = false;
    setStatus('Stopped', false);
  }

  captureBtn.addEventListener('click', function() {
    if (isCapturing) {
      endCapture();
      return;
    }
    // Never start before the disclosure has been accepted at least once.
    chrome.storage.local.get([CONSENT_KEY], function(result) {
      const accepted = result && typeof result[CONSENT_KEY] === 'number' && result[CONSENT_KEY] > 0;
      if (accepted) {
        beginCapture();
      } else {
        showConsent();
      }
    });
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
    if (!confirm('Delete all captured data from this browser? This cannot be undone.')) {
      return;
    }
    // Clearing also revokes consent, so the next capture re-shows the
    // disclosure rather than silently resuming.
    chrome.storage.local.set({
      igExporterData: { images: [], videos: [] }
    }, function() {
      chrome.storage.local.remove([CONSENT_KEY]);
      updateStats({ images: 0, videos: 0 });
      setStatus('All captured data deleted');
    });
  });
  
  // Gallery button
  document.getElementById('gallery-btn').addEventListener('click', function() {
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
