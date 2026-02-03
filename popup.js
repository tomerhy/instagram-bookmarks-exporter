/**
 * Instagram Saved Media Exporter - Popup Script
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
  const manifest = chrome.runtime.getManifest();
  versionEl.textContent = 'v' + manifest.version;
  
  // Check if we're on Instagram
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
  
  function setStatus(msg) {
    statusEl.textContent = msg;
  }
  
  function updateStats(stats) {
    imagesCount.textContent = stats.images || 0;
    videosCount.textContent = stats.videos || 0;
    carouselsCount.textContent = stats.carousels || 0;
  }
  
  function loadStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const tab = tabs[0];
      if (!tab) return;
      
      chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' }, function(response) {
        if (chrome.runtime.lastError) {
          // Content script not loaded, try loading from storage
          chrome.storage.local.get(['igExporterData'], function(result) {
            if (result.igExporterData) {
              updateStats({
                images: result.igExporterData.images?.length || 0,
                videos: result.igExporterData.videos?.length || 0,
                carousels: result.igExporterData.carousels?.length || 0
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
  
  function sendToContent(msg, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const tab = tabs[0];
      if (!tab) return;
      
      chrome.tabs.sendMessage(tab.id, msg, function(response) {
        if (chrome.runtime.lastError) {
          setStatus('Reload the Instagram page');
          return;
        }
        if (callback) callback(response);
      });
    });
  }
  
  // Scan button
  document.getElementById('scan-btn').addEventListener('click', function() {
    setStatus('Scanning...');
    sendToContent({ type: 'SCAN' }, function(response) {
      if (response) {
        updateStats(response);
        setStatus('Found ' + response.total + ' posts');
      }
    });
  });
  
  // Auto scroll button
  document.getElementById('scroll-btn').addEventListener('click', function() {
    const btn = this;
    
    if (isScrolling) {
      sendToContent({ type: 'STOP_SCROLL' });
      btn.textContent = '📜 Auto Scroll';
      isScrolling = false;
      setStatus('Stopped');
    } else {
      sendToContent({ type: 'START_SCROLL' });
      btn.textContent = '⏹️ Stop';
      isScrolling = true;
      setStatus('Scrolling...');
      
      // Poll for updates
      const pollInterval = setInterval(function() {
        if (!isScrolling) {
          clearInterval(pollInterval);
          return;
        }
        loadStats();
      }, 2000);
    }
  });
  
  // Clear button
  document.getElementById('clear-btn').addEventListener('click', function() {
    sendToContent({ type: 'CLEAR' }, function() {
      updateStats({ images: 0, videos: 0, carousels: 0 });
      setStatus('Cleared');
    });
  });
  
  // Gallery button
  document.getElementById('gallery-btn').addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') });
  });
  
  // Update stats every 3 seconds
  setInterval(loadStats, 3000);
});
