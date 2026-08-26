// Regression test for the "gallery Clear doesn't reset popup counter" bug.
//
// Scenario: user has captures in memory, the gallery (or any other context)
// writes empty arrays to chrome.storage.local. The content script must mirror
// that into its in-memory state so:
//   1. GET_STATS no longer returns stale counts to the popup
//   2. saveToStorage doesn't resurrect the cleared items on the next capture

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadContent } = require('./_setup');

function emitStorageChange(sandbox, changes, area = 'local') {
  sandbox.chrome.storage.onChanged._emit(changes, area);
}

function seedItems(c) {
  // Reach into the exposed buildItem to construct realistic items, then push
  // them onto the live state and seenUrls.
  const item = c.buildItem('image', 'https://scontent.cdninstagram.com/x.jpg', null, null, null);
  c.state.images.push(item);
  c.state.seenUrls.add(c.normalizeUrl(item.url));
}

test('content.js: external clear (empty arrays) resets in-memory state', () => {
  const { exposed: c, sandbox } = loadContent();
  seedItems(c);
  assert.equal(c.state.images.length, 1, 'precondition: state has an item');
  assert.equal(c.state.seenUrls.size, 1, 'precondition: seenUrls has an entry');

  emitStorageChange(sandbox, {
    igExporterData: { newValue: { images: [], videos: [] } }
  });

  assert.equal(c.state.images.length, 0, 'images should be cleared');
  assert.equal(c.state.videos.length, 0, 'videos should be cleared');
  assert.equal(c.state.seenUrls.size, 0, 'seenUrls should be cleared');
});

test('content.js: external clear (key removed entirely) also resets state', () => {
  const { exposed: c, sandbox } = loadContent();
  seedItems(c);

  // chrome.storage.local.remove fires onChanged with newValue === undefined.
  emitStorageChange(sandbox, {
    igExporterData: { newValue: undefined, oldValue: { images: [{}], videos: [] } }
  });

  assert.equal(c.state.images.length, 0);
  assert.equal(c.state.seenUrls.size, 0);
});

test('content.js: storage event with new items does NOT wipe state (no feedback loop)', () => {
  // Critical: the content script's own saveToStorage triggers onChanged. If
  // we wipe state on every change, the next save would reset whatever we just
  // captured. The fix's `isCleared && inMemoryHasItems` guard handles this.
  const { exposed: c, sandbox } = loadContent();
  seedItems(c);
  const before = c.state.images.length;

  // Simulate our own save firing an event with the same items.
  emitStorageChange(sandbox, {
    igExporterData: { newValue: { images: [c.state.images[0]], videos: [] } }
  });

  assert.equal(c.state.images.length, before, 'state should not be touched');
});

test('content.js: clear event when state is already empty is a no-op', () => {
  const { exposed: c, sandbox } = loadContent();
  // Don't seed anything — state starts empty.
  emitStorageChange(sandbox, {
    igExporterData: { newValue: { images: [], videos: [] } }
  });
  // No throw, state remains empty.
  assert.equal(c.state.images.length, 0);
});

test('content.js: storage event for a different key is ignored', () => {
  const { exposed: c, sandbox } = loadContent();
  seedItems(c);
  const before = c.state.images.length;

  emitStorageChange(sandbox, {
    igAutoplayEnabled: { newValue: false }  // unrelated key
  });

  assert.equal(c.state.images.length, before, 'unrelated key changes must not affect images state');
});

test('content.js: storage event for non-local area is ignored', () => {
  const { exposed: c, sandbox } = loadContent();
  seedItems(c);

  emitStorageChange(sandbox, {
    igExporterData: { newValue: { images: [], videos: [] } }
  }, 'sync');  // not 'local'

  assert.equal(c.state.images.length, 1, 'state must not be cleared by sync-area events');
});
