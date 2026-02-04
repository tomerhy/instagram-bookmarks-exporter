/**
 * Instagram Saved Media Exporter - Background Script
 * Handles data persistence and gallery management
 */

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'OPEN_GALLERY':
      chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') });
      sendResponse({ ok: true });
      break;
      
    case 'GET_DATA':
      chrome.storage.local.get(['igExporterData', 'imageUrls', 'videoUrls'], (result) => {
        sendResponse(result);
      });
      return true; // Async response
      
    case 'CLEAR_DATA':
      chrome.storage.local.remove(['igExporterData', 'imageUrls', 'videoUrls'], () => {
        sendResponse({ ok: true });
      });
      return true;
  }
});

// Handle extension install/reload
chrome.runtime.onInstalled.addListener(() => {
  // Optionally clear data on install
  // chrome.storage.local.clear();
});
