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

// Count items captured AFTER the user last engaged with the extension.
// Items without a parseable scrapedAt are treated as "already seen" (legacy
// data). When lastSeenAt is missing entirely we count nothing — the install
// handler seeds it on first run so this only triggers in pathological cases.
function countUnseen(items, lastSeenAt) {
  if (!items || !items.length) return 0;
  if (!lastSeenAt) return 0;
  let count = 0;
  for (const item of items) {
    if (!item || !item.scrapedAt) continue;
    const ts = new Date(item.scrapedAt).getTime();
    if (!isNaN(ts) && ts > lastSeenAt) count++;
  }
  return count;
}

function setBadgeFromState(data, lastSeenAt) {
  const images = (data && data.images) || [];
  const videos = (data && data.videos) || [];
  const unseen = countUnseen(images, lastSeenAt) + countUnseen(videos, lastSeenAt);
  chrome.action.setBadgeText({ text: formatBadge(unseen) });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
}

function refreshBadgeFromStorage() {
  chrome.storage.local.get(['igExporterData', 'igExporterLastSeenAt'], (result) => {
    setBadgeFromState(result.igExporterData, result.igExporterLastSeenAt);
  });
}

// Keep the badge in sync with whatever's in storage. Fires on data writes
// (captures, clears) and on lastSeenAt bumps (popup/gallery open).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes.igExporterData && !changes.igExporterLastSeenAt) return;
  refreshBadgeFromStorage();
});

// Restore the badge after browser/extension restart. On first install (or
// upgrade from a pre-badge-rework build), seed lastSeenAt so prior captures
// don't all appear as "unseen" notifications.
chrome.runtime.onStartup.addListener(refreshBadgeFromStorage);
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['igExporterLastSeenAt'], (result) => {
    if (!result.igExporterLastSeenAt) {
      chrome.storage.local.set({ igExporterLastSeenAt: Date.now() }, refreshBadgeFromStorage);
    } else {
      refreshBadgeFromStorage();
    }
  });
});

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
    formatBadge, countUnseen, setBadgeFromState, refreshBadgeFromStorage
  };
}
