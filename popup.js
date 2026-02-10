/**
 * Instagram Saved Media Exporter - Popup Script
 */

document.addEventListener('DOMContentLoaded', function() {
  const imagesCount = document.getElementById('images-count');
  const videosCount = document.getElementById('videos-count');
  const statusEl = document.getElementById('status');
  const mainContent = document.getElementById('main-content');
  const notInstagram = document.getElementById('not-instagram');
  const versionEl = document.getElementById('version');
  
  let isCapturing = false;
  
  // Set version
  try {
    versionEl.textContent = 'v' + chrome.runtime.getManifest().version;
  } catch (e) {}
  
  // Track popup page view
  if (window.Analytics) {
    Analytics.trackPageView('popup', 'Extension Popup');
  }
  
  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }
  
  function updateStats(stats) {
    if (imagesCount) imagesCount.textContent = stats.images || 0;
    if (videosCount) videosCount.textContent = stats.videos || 0;
  }
  
  // Load stats from content script or storage
  function loadStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const tab = tabs[0];
      if (!tab || !tab.id) return;
      
      chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' }, function(response) {
        if (chrome.runtime.lastError) {
          // Fallback: load from storage
          chrome.storage.local.get(['igExporterData'], function(result) {
            if (result.igExporterData) {
              updateStats({
                images: (result.igExporterData.images || []).length,
                videos: (result.igExporterData.videos || []).length
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
  
  // Capture All button
  const captureBtn = document.getElementById('capture-btn');
  captureBtn.addEventListener('click', function() {
    if (isCapturing) {
      if (window.Analytics) Analytics.trackButtonClick('stop_capture', 'popup');
      sendToContent({ type: 'STOP_CAROUSELS' });
      captureBtn.textContent = '🎠 Capture All';
      isCapturing = false;
      setStatus('Stopped');
    } else {
      if (window.Analytics) Analytics.trackButtonClick('start_capture', 'popup');
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
      captureBtn.textContent = '⏹️ Stop';
      isCapturing = true;
      setStatus('Capturing all posts...');
    }
  });
  
  // Clear button
  document.getElementById('clear-btn').addEventListener('click', function() {
    if (window.Analytics) Analytics.trackButtonClick('clear', 'popup');
    sendToContent({ type: 'CLEAR' }, function() {
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
  
  // Poll for stats updates
  setInterval(loadStats, 2000);
});
