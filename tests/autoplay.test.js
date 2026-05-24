// Unit tests for autoplay.js — item 21 (post-v4.4.0).
//
// autoplay.js is ~570 lines of IntersectionObserver + MutationObserver
// orchestration around the page's <video> elements. The browser-level
// surface (does the right video actually start playing when scrolled into
// view, does manual pause stick, do user prefs persist across page loads)
// belongs in browser e2e tests, gated on hitting the 1k-user threshold
// from the tech-debt plan.
//
// What we CAN cover at the JS-unit level without a real browser:
//   - debounce()       pure utility
//   - formatDuration() pure utility
//   - loadPreferences() / savePreferences()  storage round-trip
//   - setEnabled() side effects (state.enabled + savePreferences)
//   - CONFIG defaults (regression net against silent value drift)
//
// The rest stays in the manual QA checklist (section H).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadIIFE } = require('./_setup');

function loadAutoplay() {
  const { exposed, sandbox } = loadIIFE('autoplay.js');
  return { ap: exposed, sandbox };
}

// ---------- CONFIG: regression net for silent value drift ----------

test('CONFIG: defaults haven\'t silently changed', () => {
  const { ap } = loadAutoplay();
  assert.equal(ap.CONFIG.visibilityThreshold, 0.5, '50% visibility to trigger play');
  assert.equal(ap.CONFIG.debounceDelay, 100, '100ms perf debounce');
  assert.equal(ap.CONFIG.defaultEnabled, true);
  assert.equal(ap.CONFIG.defaultMuted, true);
  assert.equal(ap.CONFIG.preloadThreshold, 0.8, 'preload next video at 80% through current');
});

test('CONFIG: class names match the CSS contract', () => {
  // If these strings ever drift from what the (now-deleted) inline CSS used,
  // playing/muted/paused indicators silently break. Keeping a test here so
  // a rename in one place doesn\'t go unnoticed.
  const { ap } = loadAutoplay();
  assert.equal(ap.CONFIG.classes.playing,   'ig-autoplay-playing');
  assert.equal(ap.CONFIG.classes.muted,     'ig-autoplay-muted');
  assert.equal(ap.CONFIG.classes.paused,    'ig-autoplay-paused');
  assert.equal(ap.CONFIG.classes.indicator, 'ig-autoplay-indicator');
});

test('state: initialized from CONFIG defaults', () => {
  const { ap } = loadAutoplay();
  assert.equal(ap.state.enabled, ap.CONFIG.defaultEnabled);
  assert.equal(ap.state.muted, ap.CONFIG.defaultMuted);
  // Cross-realm: Map/Set created inside the vm sandbox aren't `instanceof`
  // the test realm's Map/Set. Duck-type the API instead.
  assert.equal(typeof ap.state.videos.set, 'function', 'videos is a Map-like');
  assert.equal(typeof ap.state.videos.size, 'number');
  assert.equal(typeof ap.state.manuallyPaused.add, 'function', 'manuallyPaused is a Set-like');
  assert.equal(typeof ap.state.manuallyPaused.size, 'number');
  assert.equal(ap.state.currentlyPlaying, null);
});

// ---------- formatDuration ----------

test('formatDuration: standard minutes:seconds output, zero-padded seconds', () => {
  const { ap } = loadAutoplay();
  assert.equal(ap.formatDuration(0),    '0:00');
  assert.equal(ap.formatDuration(7),    '0:07');
  assert.equal(ap.formatDuration(59),   '0:59');
  assert.equal(ap.formatDuration(60),   '1:00');
  assert.equal(ap.formatDuration(125),  '2:05');
  assert.equal(ap.formatDuration(3661), '61:01', 'minutes do not wrap to hours');
});

test('formatDuration: NaN / undefined / null / negative → "0:00" (defensive)', () => {
  const { ap } = loadAutoplay();
  assert.equal(ap.formatDuration(NaN),       '0:00');
  assert.equal(ap.formatDuration(undefined), '0:00');
  assert.equal(ap.formatDuration(null),      '0:00');
  // !isFinite catches Infinity too
  assert.equal(ap.formatDuration(Infinity),  '0:00');
});

test('formatDuration: fractional seconds round DOWN', () => {
  const { ap } = loadAutoplay();
  assert.equal(ap.formatDuration(59.9),  '0:59', 'not 1:00');
  assert.equal(ap.formatDuration(125.4), '2:05');
});

// ---------- debounce ----------

test('debounce: fires once after the quiet period', () => {
  return new Promise((resolve) => {
    const { ap } = loadAutoplay();
    let calls = 0;
    const fn = ap.debounce(() => { calls++; }, 20);

    fn(); fn(); fn();
    // Immediate: nothing has fired yet.
    assert.equal(calls, 0);

    setTimeout(() => {
      assert.equal(calls, 1, 'three rapid calls collapse into one trailing call');
      resolve();
    }, 50);
  });
});

test('debounce: extra calls inside the wait window reset the timer', () => {
  return new Promise((resolve) => {
    const { ap } = loadAutoplay();
    let calls = 0;
    const fn = ap.debounce(() => { calls++; }, 30);

    fn();                              // t=0
    setTimeout(fn, 15);                // t=15  — resets timer to t=45
    setTimeout(() => {
      // At t=35 we are PAST the original 30ms but BEFORE the reset 45ms
      // (the timer restarted at t=15). So nothing has fired yet.
      assert.equal(calls, 0, 'second call within window resets timer');
    }, 35);
    setTimeout(() => {
      assert.equal(calls, 1, 'final call fires after the reset window expires');
      resolve();
    }, 70);
  });
});

test('debounce: passes through arguments to the wrapped function', () => {
  return new Promise((resolve) => {
    const { ap } = loadAutoplay();
    let received = null;
    const fn = ap.debounce((a, b) => { received = [a, b]; }, 10);
    fn('hello', 42);
    setTimeout(() => {
      assert.deepEqual(received, ['hello', 42]);
      resolve();
    }, 30);
  });
});

// ---------- loadPreferences / savePreferences ----------

test('loadPreferences: reads igAutoplayEnabled + igAutoplayMuted from chrome.storage', async () => {
  const { ap, sandbox } = loadAutoplay();
  sandbox.chrome.storage.local.get = (keys, cb) => {
    cb({ igAutoplayEnabled: false, igAutoplayMuted: false });
  };
  await ap.loadPreferences();
  assert.equal(ap.state.enabled, false, 'enabled override applied');
  assert.equal(ap.state.muted,   false, 'muted override applied');
});

test('loadPreferences: missing keys → state keeps the CONFIG defaults', async () => {
  const { ap, sandbox } = loadAutoplay();
  // Storage returns an empty object (user has never set the prefs).
  sandbox.chrome.storage.local.get = (keys, cb) => cb({});
  await ap.loadPreferences();
  assert.equal(ap.state.enabled, ap.CONFIG.defaultEnabled,
    'no-op when storage has no value');
  assert.equal(ap.state.muted, ap.CONFIG.defaultMuted);
});

test('loadPreferences: explicit false is honored (NOT treated as "no value")', async () => {
  // Defensive: an early version that used `if (result.igAutoplayEnabled)`
  // instead of `!== undefined` would silently ignore the user choosing
  // "off". Guarding against that regression.
  const { ap, sandbox } = loadAutoplay();
  sandbox.chrome.storage.local.get = (keys, cb) => cb({ igAutoplayEnabled: false });
  await ap.loadPreferences();
  assert.equal(ap.state.enabled, false, 'explicit false must override the default true');
});

test('loadPreferences: resolves cleanly when chrome.storage is absent', async () => {
  const { ap, sandbox } = loadAutoplay();
  sandbox.chrome = undefined;
  // Should resolve without throwing, even with no storage.
  await assert.doesNotReject(ap.loadPreferences());
});

test('savePreferences: writes both keys to chrome.storage with the current state values', () => {
  const { ap, sandbox } = loadAutoplay();
  let writtenItems = null;
  sandbox.chrome.storage.local.set = (items) => { writtenItems = items; };

  ap.state.enabled = false;
  ap.state.muted   = true;
  ap.savePreferences();

  assert.deepEqual(JSON.parse(JSON.stringify(writtenItems)), {
    igAutoplayEnabled: false,
    igAutoplayMuted: true
  });
});

test('savePreferences: silently no-ops when chrome.storage is gone', () => {
  const { ap, sandbox } = loadAutoplay();
  sandbox.chrome = undefined;
  assert.doesNotThrow(() => ap.savePreferences(),
    'storage write must survive an extension-context-invalidated scenario');
});

// ---------- setEnabled ----------

test('setEnabled(true): flips state.enabled + persists', () => {
  const { ap, sandbox } = loadAutoplay();
  let saved = null;
  sandbox.chrome.storage.local.set = (items) => { saved = items; };

  ap.state.enabled = false;
  ap.setEnabled(true);
  assert.equal(ap.state.enabled, true);
  assert.equal(saved.igAutoplayEnabled, true,
    'state change is persisted to storage in the same call');
});

test('setEnabled(false): flips state.enabled + persists', () => {
  const { ap, sandbox } = loadAutoplay();
  let saved = null;
  sandbox.chrome.storage.local.set = (items) => { saved = items; };

  ap.state.enabled = true;
  ap.setEnabled(false);
  assert.equal(ap.state.enabled, false);
  assert.equal(saved.igAutoplayEnabled, false);
});
