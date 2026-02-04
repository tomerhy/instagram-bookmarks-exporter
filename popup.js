/**
 * Instagram Saved Media Exporter - Popup Script
 */

document.addEventListener('DOMContentLoaded', function() {
  const imagesCount = document.getElementById('images-count');
  const videosCount = document.getElementById('videos-count');
  const totalCount = document.getElementById('total-count');
  const statusEl = document.getElementById('status');
  const mainContent = document.getElementById('main-content');
  const notInstagram = document.getElementById('not-instagram');
  const versionEl = document.getElementById('version');
  
  let isCapturing = false;
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
    if (totalCount) {
      // Show total saved only after scrolling, otherwise show "-"
      totalCount.textContent = stats.totalSaved ? stats.totalSaved : '-';
    }
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
  
  // Capture Carousels button
  const captureBtn = document.getElementById('capture-btn');
  captureBtn.addEventListener('click', function() {
    if (isCapturing) {
      sendToContent({ type: 'STOP_CAROUSELS' });
      captureBtn.textContent = '🎠 Capture Carousels';
      isCapturing = false;
      setStatus('Stopped');
    } else {
      sendToContent({ type: 'START_CAROUSELS' }, function(response) {
        if (response) {
          updateStats(response);
        }
      });
      captureBtn.textContent = '⏹️ Stop Capture';
      isCapturing = true;
      setStatus('Capturing...');
    }
  });
  
  // Auto scroll button (just scrolls, doesn't capture)
  const scrollBtn = document.getElementById('scroll-btn');
  scrollBtn.addEventListener('click', function() {
    if (isScrolling) {
      sendToContent({ type: 'STOP_SCROLL' });
      scrollBtn.textContent = '📜 Auto Scroll';
      isScrolling = false;
      setStatus('Stopped');
    } else {
      sendToContent({ type: 'START_SCROLL' });
      scrollBtn.textContent = '⏹️ Stop';
      isScrolling = true;
      setStatus('Scrolling to load posts...');
    }
  });
  
  // Clear button
  document.getElementById('clear-btn').addEventListener('click', function() {
    sendToContent({ type: 'CLEAR' }, function() {
      updateStats({ images: 0, videos: 0 });
      setStatus('Cleared!');
    });
  });
  
  // Gallery button
  document.getElementById('gallery-btn').addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') });
  });
  
  // Poll for stats updates
  setInterval(loadStats, 2000);
});
