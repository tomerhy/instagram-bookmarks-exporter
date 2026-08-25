// Tests for the toolbar badge counter in background.js.
//
// The badge represents UNSEEN captures (items added since the user last
// opened the popup or gallery), not the total in storage. Counting totals
// produced a bad UX where opening the extension days later still showed
// "174" from a long-finished scan — see the v4.3.1 fix.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTopLevel } = require('./_setup');

function loadBackground(extraSetup) {
  return loadTopLevel('background.js', extraSetup);
}

function emit(sandbox, changes, area = 'local') {
  sandbox.chrome.storage.onChanged._emit(changes, area);
}

function item(scrapedAtMs) {
  return { scrapedAt: new Date(scrapedAtMs).toISOString() };
}

// Mutable in-storage state that get() reads from. Tests can mutate this
// directly and then trigger storage events to simulate the real fan-out.
function withStorage(initial) {
  return (sb) => {
    const store = Object.assign({}, initial || {});
    sb.chrome.storage.local.get = (keys, cb) => {
      const out = {};
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) if (k in store) out[k] = store[k];
      cb(out);
    };
    sb.chrome.storage.local.set = (data, cb) => {
      Object.assign(store, data);
      if (cb) cb();
    };
    sb.chrome.storage._store = store;
  };
}

// ---------- formatBadge (pure formatter, unchanged) ----------

test('formatBadge: zero or negative renders as empty string (no badge shown)', () => {
  const bg = loadBackground();
  assert.equal(bg.formatBadge(0), '');
  assert.equal(bg.formatBadge(-1), '');
  assert.equal(bg.formatBadge(null), '');
  assert.equal(bg.formatBadge(undefined), '');
});

test('formatBadge: small numbers render literally', () => {
  const bg = loadBackground();
  assert.equal(bg.formatBadge(1), '1');
  assert.equal(bg.formatBadge(47), '47');
  assert.equal(bg.formatBadge(999), '999');
});

test('formatBadge: thousands shorten to N.Nk', () => {
  const bg = loadBackground();
  assert.equal(bg.formatBadge(1000), '1.0k');
  assert.equal(bg.formatBadge(1234), '1.2k');
  assert.equal(bg.formatBadge(9999), '10.0k');
});

test('formatBadge: ten-thousands+ drop the decimal', () => {
  const bg = loadBackground();
  assert.equal(bg.formatBadge(10000), '10k');
  assert.equal(bg.formatBadge(99999), '99k');
});

test('formatBadge: million+ caps at 999+', () => {
  const bg = loadBackground();
  assert.equal(bg.formatBadge(1000000), '999+');
  assert.equal(bg.formatBadge(50000000), '999+');
});

// ---------- countUnseen (notification semantics) ----------

test('countUnseen: only items newer than lastSeenAt are counted', () => {
  const bg = loadBackground();
  const lastSeen = 1000;
  const items = [item(500), item(800), item(1500), item(2000)];
  assert.equal(bg.countUnseen(items, lastSeen), 2);
});

test('countUnseen: missing lastSeenAt → 0 (defensive — install handler seeds it)', () => {
  const bg = loadBackground();
  assert.equal(bg.countUnseen([item(1), item(2), item(3)], undefined), 0);
  assert.equal(bg.countUnseen([item(1), item(2), item(3)], null), 0);
  assert.equal(bg.countUnseen([item(1), item(2), item(3)], 0), 0);
});

test('countUnseen: items missing scrapedAt are treated as already seen (legacy data)', () => {
  const bg = loadBackground();
  const lastSeen = 1000;
  const items = [{}, { scrapedAt: null }, item(1500), { scrapedAt: 'garbage' }];
  assert.equal(bg.countUnseen(items, lastSeen), 1);
});

test('countUnseen: empty/null list → 0', () => {
  const bg = loadBackground();
  assert.equal(bg.countUnseen([], 1000), 0);
  assert.equal(bg.countUnseen(null, 1000), 0);
  assert.equal(bg.countUnseen(undefined, 1000), 0);
});

// ---------- onChanged → badge sync ----------

test('storage write with all-new items shows their delta on the badge', () => {
  const sandbox = loadBackground(withStorage({
    igExporterData: { images: [item(2000), item(3000)], videos: [item(4000)] },
    igExporterLastSeenAt: 1000
  }));
  emit(sandbox, { igExporterData: { newValue: sandbox.chrome.storage._store.igExporterData } });
  assert.equal(sandbox.chrome.action._badgeState.text, '3');
  assert.equal(sandbox.chrome.action._badgeState.color, '#0F8B8D');
});

test('storage write where everything was already seen → no badge', () => {
  const sandbox = loadBackground(withStorage({
    igExporterData: { images: [item(100), item(200)], videos: [item(300)] },
    igExporterLastSeenAt: 5000
  }));
  emit(sandbox, { igExporterData: { newValue: sandbox.chrome.storage._store.igExporterData } });
  assert.equal(sandbox.chrome.action._badgeState.text, '');
});

test('bumping lastSeenAt clears the badge (popup/gallery open path)', () => {
  const sandbox = loadBackground(withStorage({
    igExporterData: { images: [item(2000), item(3000)], videos: [] },
    igExporterLastSeenAt: 1000
  }));
  // Items are unseen at first
  emit(sandbox, { igExporterData: { newValue: sandbox.chrome.storage._store.igExporterData } });
  assert.equal(sandbox.chrome.action._badgeState.text, '2');

  // User opens popup → lastSeenAt bumped past all items
  sandbox.chrome.storage._store.igExporterLastSeenAt = 9999;
  emit(sandbox, { igExporterLastSeenAt: { newValue: 9999 } });
  assert.equal(sandbox.chrome.action._badgeState.text, '');
});

test('storage clear (data removed) hides the badge', () => {
  const sandbox = loadBackground(withStorage({
    igExporterData: { images: [item(2000)], videos: [] },
    igExporterLastSeenAt: 1000
  }));
  emit(sandbox, { igExporterData: { newValue: sandbox.chrome.storage._store.igExporterData } });
  assert.equal(sandbox.chrome.action._badgeState.text, '1');

  sandbox.chrome.storage._store.igExporterData = { images: [], videos: [] };
  emit(sandbox, { igExporterData: { newValue: { images: [], videos: [] } } });
  assert.equal(sandbox.chrome.action._badgeState.text, '');
});

test('storage event for unrelated key does not touch the badge', () => {
  const sandbox = loadBackground(withStorage({
    igExporterData: { images: [item(2000)], videos: [] },
    igExporterLastSeenAt: 1000
  }));
  emit(sandbox, { igExporterData: { newValue: sandbox.chrome.storage._store.igExporterData } });
  const beforeCalls = sandbox.chrome.action._badgeState.calls.length;

  emit(sandbox, { igAutoplayEnabled: { newValue: false } });

  assert.equal(sandbox.chrome.action._badgeState.calls.length, beforeCalls,
    'unrelated key change should not trigger setBadgeText');
});

test('non-local storage area is ignored', () => {
  const sandbox = loadBackground(withStorage({
    igExporterData: { images: [item(2000)], videos: [] },
    igExporterLastSeenAt: 1000
  }));
  emit(sandbox, { igExporterData: { newValue: sandbox.chrome.storage._store.igExporterData } }, 'sync');
  assert.equal(sandbox.chrome.action._badgeState.text, null,
    'sync-area changes should not paint the badge');
});

// ---------- onStartup / onInstalled ----------

test('onInstalled seeds lastSeenAt on first run so existing data appears seen', () => {
  // Existing user upgrading: 174 items, no lastSeenAt yet. After install
  // they should see badge=0, not "174".
  const items = new Array(174).fill(0).map(() => item(1));
  const sandbox = loadBackground(withStorage({
    igExporterData: { images: items, videos: [] }
    // no igExporterLastSeenAt
  }));
  sandbox.chrome.runtime.onInstalled._emit();
  assert.ok(sandbox.chrome.storage._store.igExporterLastSeenAt,
    'install handler should seed lastSeenAt when missing');
  assert.equal(sandbox.chrome.action._badgeState.text, '',
    'previously-captured items should not appear as unseen on upgrade');
});

test('onInstalled does NOT overwrite an existing lastSeenAt', () => {
  const sandbox = loadBackground(withStorage({
    igExporterData: { images: [item(2000)], videos: [] },
    igExporterLastSeenAt: 1000
  }));
  sandbox.chrome.runtime.onInstalled._emit();
  assert.equal(sandbox.chrome.storage._store.igExporterLastSeenAt, 1000,
    'a reinstall should not erase the user\'s last-seen timestamp');
  assert.equal(sandbox.chrome.action._badgeState.text, '1',
    'badge should reflect the genuinely unseen item');
});

test('onStartup restores badge from existing storage', () => {
  const sandbox = loadBackground(withStorage({
    igExporterData: { images: [item(2000), item(3000)], videos: [] },
    igExporterLastSeenAt: 1000
  }));
  sandbox.chrome.runtime.onStartup._emit();
  assert.equal(sandbox.chrome.action._badgeState.text, '2');
});

test('onStartup with empty storage shows no badge', () => {
  const sandbox = loadBackground(withStorage({}));
  sandbox.chrome.runtime.onStartup._emit();
  assert.equal(sandbox.chrome.action._badgeState.text, '');
});
