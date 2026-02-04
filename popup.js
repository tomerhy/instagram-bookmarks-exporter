/**
 * Instagram Saved Media Exporter - Popup Script
 * Simplified & Reliable
 */

document.addEventListener('DOMContentLoaded', function() {
  const imagesCount = document.getElementById('images-count');
  const videosCount = document.getElementById('videos-count');
  const carouselsCount = document.getElementById('carousels-count');
  const statusEl = document.getElementById('status');
  const mainContent = document.getElementById('main-content');
  const notInstagram = document.getElementById('not-instagram');
  const versionEl = document.getElementById('version');
  
  let isScrolling = false;
  
  // Set version
  try {
    versionEl.textContent = 'v' + chrome.runtime.getManifest().version;
  } catch (e) {}
  
  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }
  
  function updateStats(stats) {
    if (imagesCount) imagesCount.textContent = stats.images || 0;
    if (videosCount) videosCount.textContent = stats.videos || 0;
    if (carouselsCount) carouselsCount.textContent = stats.carousels || 0;
  }
  
  // Load stats from content script or storage
  function loadStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const tab = tabs[0];
      if (!tab || !tab.id) return;
      
      // Try to get stats from content script
      chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' }, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Content script not responding, trying storage');
          // Fallback: load from storage
          chrome.storage.local.get(['igExporterData'], function(result) {
            if (result.igExporterData) {
              updateStats({
                images: (result.igExporterData.images || []).length,
                videos: (result.igExporterData.videos || []).length,
                carousels: (result.igExporterData.carousels || []).length
              });
            }
          });
          return;
        }
        
        if (response) {
          updateStats(response);
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
  
  // Check if on Instagram
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
  
  // Track popup open
  if (window.Analytics) {
    Analytics.trackPageView('popup', 'Extension Popup');
  }
  
  // Scan button
  document.getElementById('scan-btn').addEventListener('click', function() {
    setStatus('Scanning...');
    
    // Track scan click
    if (window.Analytics) {
      Analytics.trackButtonClick('scan', 'popup');
    }
    
    sendToContent({ type: 'SCAN' }, function(response) {
      if (response) {
        updateStats(response);
        setStatus('Found ' + (response.total || 0) + ' items');
        
        // Track capture stats
        if (window.Analytics) {
          Analytics.trackCaptureStats(response.images || 0, response.videos || 0);
        }
      }
    });
  });
  
  // Auto scroll button
  const scrollBtn = document.getElementById('scroll-btn');
  scrollBtn.addEventListener('click', function() {
    if (isScrolling) {
      sendToContent({ type: 'STOP_SCROLL' });
      scrollBtn.textContent = '📜 Auto Scroll';
      isScrolling = false;
      setStatus('Stopped');
      
      if (window.Analytics) {
        Analytics.trackButtonClick('stop_scroll', 'popup');
      }
    } else {
      sendToContent({ type: 'START_SCROLL' });
      scrollBtn.textContent = '⏹️ Stop';
      isScrolling = true;
      setStatus('Scrolling...');
      
      if (window.Analytics) {
        Analytics.trackButtonClick('start_scroll', 'popup');
        Analytics.trackFeature('auto_scroll');
      }
    }
  });
  
  // Clear button
  document.getElementById('clear-btn').addEventListener('click', function() {
    if (window.Analytics) {
      Analytics.trackButtonClick('clear', 'popup');
    }
    
    sendToContent({ type: 'CLEAR' }, function() {
      updateStats({ images: 0, videos: 0, carousels: 0 });
      setStatus('Cleared!');
    });
  });
  
  // Gallery button
  document.getElementById('gallery-btn').addEventListener('click', function() {
    if (window.Analytics) {
      Analytics.trackButtonClick('open_gallery', 'popup');
    }
    
    chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') });
  });
  
  // Auto-play toggle (optional feature)
  const autoplayToggle = document.getElementById('autoplay-toggle');
  const mutedToggle = document.getElementById('muted-toggle');
  
  if (autoplayToggle) {
    chrome.storage.local.get(['igAutoplayEnabled', 'igAutoplayMuted'], function(result) {
      autoplayToggle.checked = result.igAutoplayEnabled !== false;
      if (mutedToggle) mutedToggle.checked = result.igAutoplayMuted !== false;
    });
    
    autoplayToggle.addEventListener('change', function() {
      chrome.storage.local.set({ igAutoplayEnabled: this.checked });
      setStatus(this.checked ? 'Auto-play enabled' : 'Auto-play disabled');
      
      if (window.Analytics) {
        Analytics.trackFeature('autoplay_toggle', { enabled: this.checked });
      }
    });
  }
  
  if (mutedToggle) {
    mutedToggle.addEventListener('change', function() {
      chrome.storage.local.set({ igAutoplayMuted: this.checked });
      setStatus(this.checked ? 'Videos muted' : 'Videos unmuted');
      
      if (window.Analytics) {
        Analytics.trackFeature('muted_toggle', { muted: this.checked });
      }
    });
  }
  
  // Poll for stats updates
  setInterval(loadStats, 2000);
});
