/**
 * Instagram Saved Media Exporter - Background Script
 * Handles data persistence, gallery navigation, and the toolbar badge counter.
 */

const BADGE_COLOR = '#E1306C';

// Format the total for the toolbar badge. Chrome shows ~4 chars max so cap.
function formatBadge(total) {
  if (!total || total <= 0) return '';
  if (total < 1000) return String(total);
  if (total < 10000) return (total / 1000).toFixed(1) + 'k';   // 1.2k
  if (total < 1000000) return Math.floor(total / 1000) + 'k';  // 12k, 999k
  return '999+';
}

function setBadgeFromCounts(images, videos) {
  const total = (images || 0) + (videos || 0);
  chrome.action.setBadgeText({ text: formatBadge(total) });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
}

function refreshBadgeFromStorage() {
  chrome.storage.local.get(['igExporterData'], (result) => {
    const data = result.igExporterData;
    setBadgeFromCounts(
      (data && data.images && data.images.length) || 0,
      (data && data.videos && data.videos.length) || 0
    );
  });
}

// Keep the badge in sync with whatever's in storage. Fires on any write —
// content script captures, gallery clears, popup clears, manual edits.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes.igExporterData) return;
  const next = changes.igExporterData.newValue;
  setBadgeFromCounts(
    (next && next.images && next.images.length) || 0,
    (next && next.videos && next.videos.length) || 0
  );
});

// Restore the badge after browser/extension restart — service workers don't
// keep state across wake-ups.
chrome.runtime.onStartup.addListener(refreshBadgeFromStorage);
chrome.runtime.onInstalled.addListener(refreshBadgeFromStorage);

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

// Test seam: only fires when tests set __IG_EXPORTER_TEST_HOOKS__ before
// loading the source. No-op in the browser.
if (typeof globalThis !== 'undefined' && globalThis.__IG_EXPORTER_TEST_HOOKS__) {
  globalThis.__IG_EXPORTER_TEST_HOOKS__.background = {
    formatBadge, setBadgeFromCounts, refreshBadgeFromStorage
  };
}
