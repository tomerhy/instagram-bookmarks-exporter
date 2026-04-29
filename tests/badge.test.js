// Tests for the toolbar badge counter in background.js.
//
// Regression target: pre-v4.3 behavior was that captures during manual
// scrolling produced no visible feedback (the in-page floating panel had been
// removed in v4.4.0 and never re-wired). The badge fixes this by mirroring
// the total capture count onto the toolbar action icon, which is visible
// regardless of which tab is active or whether the popup is open.

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

// ---------- formatBadge ----------

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

// ---------- onChanged → badge sync (the user-visible bug) ----------

test('storage write with new totals updates the badge', () => {
  const sandbox = loadBackground();
  emit(sandbox, {
    igExporterData: { newValue: { images: new Array(20).fill({}), videos: new Array(5).fill({}) } }
  });
  assert.equal(sandbox.chrome.action._badgeState.text, '25');
  assert.equal(sandbox.chrome.action._badgeState.color, '#E1306C');
});

test('storage clear (empty arrays) hides the badge', () => {
  const sandbox = loadBackground();
  // Seed it
  emit(sandbox, { igExporterData: { newValue: { images: [{}], videos: [] } } });
  assert.equal(sandbox.chrome.action._badgeState.text, '1');
  // Clear it
  emit(sandbox, { igExporterData: { newValue: { images: [], videos: [] } } });
  assert.equal(sandbox.chrome.action._badgeState.text, '');
});

test('storage event for unrelated key does not touch the badge', () => {
  const sandbox = loadBackground();
  emit(sandbox, { igExporterData: { newValue: { images: [{}, {}], videos: [] } } });
  const beforeCalls = sandbox.chrome.action._badgeState.calls.length;

  emit(sandbox, { igAutoplayEnabled: { newValue: false } });

  assert.equal(sandbox.chrome.action._badgeState.calls.length, beforeCalls,
    'unrelated key change should not trigger setBadgeText');
});

test('non-local storage area is ignored', () => {
  const sandbox = loadBackground();
  emit(sandbox, { igExporterData: { newValue: { images: [{}, {}, {}], videos: [] } } }, 'sync');
  assert.equal(sandbox.chrome.action._badgeState.text, null,
    'sync-area changes should not paint the badge');
});

// ---------- onStartup / onInstalled (service-worker wake-up restore) ----------

test('onInstalled restores badge from existing storage', () => {
  let getCalled = false;
  const sandbox = loadBackground((sb) => {
    sb.chrome.storage.local.get = (_keys, cb) => {
      getCalled = true;
      cb({ igExporterData: { images: new Array(7).fill({}), videos: new Array(3).fill({}) } });
    };
  });
  sandbox.chrome.runtime.onInstalled._emit();
  assert.ok(getCalled, 'onInstalled should read from storage');
  assert.equal(sandbox.chrome.action._badgeState.text, '10');
});

test('onStartup restores badge from existing storage', () => {
  const sandbox = loadBackground((sb) => {
    sb.chrome.storage.local.get = (_keys, cb) => {
      cb({ igExporterData: { images: new Array(2).fill({}), videos: new Array(0).fill({}) } });
    };
  });
  sandbox.chrome.runtime.onStartup._emit();
  assert.equal(sandbox.chrome.action._badgeState.text, '2');
});

test('onStartup with empty storage shows no badge', () => {
  const sandbox = loadBackground((sb) => {
    sb.chrome.storage.local.get = (_keys, cb) => cb({});
  });
  sandbox.chrome.runtime.onStartup._emit();
  assert.equal(sandbox.chrome.action._badgeState.text, '');
});
