// Phase 3 evidence: capture is inactive by default, nothing is stored before
// an explicit Start, Stop restores the page's own fetch/XHR, and the consent
// gate cannot be bypassed by a forged message.
//
// These are the tests that back the "capture only on explicit user action"
// claim in the store listing and privacy policy, so they assert on observable
// behaviour (was fetch replaced? did storage get written?) rather than on
// internal bookkeeping flags alone.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadContent, loadCaptureHook } = require('./_setup');

const CDN = 'https://scontent.cdninstagram.com/v/t51/real_n.jpg';
const IG_ORIGIN = 'https://www.instagram.com';

// `source` is intentionally omitted: __emitMessage fills in the contextified
// global, which is what the production `event.source !== window` check compares
// against. Tests that want to *fail* that check pass an explicit source.
function mediaEvent(_sandbox, media, overrides) {
  return Object.assign({
    origin: IG_ORIGIN,
    data: { type: 'SBE_MEDIA', media: media }
  }, overrides || {});
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

test('content.js: capture is inactive on load', () => {
  const { exposed } = loadContent();
  assert.equal(exposed.captureActive, false);
});

test('capture-hook.js: nothing is patched on load', () => {
  const { exposed, sandbox } = loadCaptureHook();
  assert.equal(exposed.active, false, 'reader must start inert');
  assert.equal(exposed.installed, false, 'reader must not have wrapped anything');
  // The page's own functions are still the originals.
  assert.equal(typeof sandbox.fetch, 'function');
  assert.equal(sandbox.window.fetch, sandbox.fetch);
});

test('content.js: merely loading on instagram.com writes nothing to storage', () => {
  const writes = [];
  const { sandbox } = loadContent((s) => {
    s.chrome.runtime.id = 'test-id';
    s.chrome.storage.local.set = (data, cb) => { writes.push(data); if (cb) cb(); };
  });
  assert.equal(writes.length, 0, 'no storage write may happen at load time: ' +
    JSON.stringify(writes));
  assert.ok(sandbox);
});

// ---------------------------------------------------------------------------
// Nothing is accepted while capture is off
// ---------------------------------------------------------------------------

test('content.js: SBE_MEDIA is discarded while capture is inactive', () => {
  const { exposed, sandbox } = loadContent((s) => { s.chrome.runtime.id = 'test-id'; });
  const before = exposed.state.images.length;

  sandbox.__emitMessage(mediaEvent(sandbox, [
    { type: 'image', url: CDN, thumbnail: null, context: null }
  ]));

  assert.equal(exposed.state.images.length, before,
    'a valid media message must still be dropped when capture is off');
});

test('content.js: a valid message IS accepted once capture is active', () => {
  const { exposed, sandbox } = loadContent((s) => { s.chrome.runtime.id = 'test-id'; });
  exposed.startCapture();

  sandbox.__emitMessage(mediaEvent(sandbox, [
    { type: 'image', url: CDN, thumbnail: null, context: null }
  ]));

  assert.equal(exposed.state.images.length, 1,
    'capture is on, so an allowlisted image should be stored');
  assert.equal(exposed.state.images[0].url, CDN);
});

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

test('content.js: withConsent reports false when no consent is stored', (t, done) => {
  const { exposed } = loadContent((s) => {
    s.chrome.runtime.id = 'test-id';
    s.chrome.storage.local.get = (_keys, cb) => cb({});
  });
  exposed.withConsent((granted) => {
    assert.equal(granted, false);
    done();
  });
});

test('content.js: withConsent reports true only for a positive numeric stamp', (t, done) => {
  const cases = [
    [{ sbeConsentAcceptedAt: Date.parse('2026-01-01') }, true],
    [{ sbeConsentAcceptedAt: 0 }, false],
    [{ sbeConsentAcceptedAt: -1 }, false],
    // A forged non-numeric value must not count as consent.
    [{ sbeConsentAcceptedAt: 'yes' }, false],
    [{ sbeConsentAcceptedAt: true }, false],
    [{}, false]
  ];
  let remaining = cases.length;
  for (const [stored, expected] of cases) {
    const { exposed } = loadContent((s) => {
      s.chrome.runtime.id = 'test-id';
      s.chrome.storage.local.get = (_keys, cb) => cb(stored);
    });
    exposed.withConsent((granted) => {
      assert.equal(granted, expected,
        'stored=' + JSON.stringify(stored) + ' should yield ' + expected);
      if (--remaining === 0) done();
    });
  }
});

// ---------------------------------------------------------------------------
// Start / stop lifecycle
// ---------------------------------------------------------------------------

test('content.js: startCapture signals the MAIN-world reader to install', () => {
  const { exposed, sandbox } = loadContent((s) => { s.chrome.runtime.id = 'test-id'; });
  exposed.startCapture();

  const control = sandbox.__posted.filter(m => m.data && m.data.type === 'SBE_CAPTURE_CONTROL');
  assert.equal(control.length, 1);
  assert.equal(control[0].data.action, 'start');
  assert.equal(exposed.captureActive, true);
  // Control messages must be targeted at the page origin, never '*'.
  assert.notEqual(control[0].origin, '*');
});

test('content.js: stopCapture drops the gate and signals uninstall', () => {
  const { exposed, sandbox } = loadContent((s) => { s.chrome.runtime.id = 'test-id'; });
  exposed.startCapture();
  sandbox.__posted.length = 0;
  exposed.stopCapture();

  assert.equal(exposed.captureActive, false);
  const control = sandbox.__posted.filter(m => m.data && m.data.type === 'SBE_CAPTURE_CONTROL');
  assert.equal(control.length, 1);
  assert.equal(control[0].data.action, 'stop');
});

test('content.js: media arriving after Stop is discarded', () => {
  const { exposed, sandbox } = loadContent((s) => { s.chrome.runtime.id = 'test-id'; });
  exposed.startCapture();
  exposed.stopCapture();
  const before = exposed.state.images.length;

  sandbox.__emitMessage(mediaEvent(sandbox, [
    { type: 'image', url: CDN, thumbnail: null, context: null }
  ]));

  assert.equal(exposed.state.images.length, before,
    'a response landing after Stop must not be stored');
});

// ---------------------------------------------------------------------------
// The reader: install / uninstall really do wrap and unwrap
// ---------------------------------------------------------------------------

test('capture-hook.js: start wraps fetch and XHR, stop restores them', () => {
  const { exposed, sandbox } = loadCaptureHook();
  const originalFetch = sandbox.window.fetch;
  const originalOpen = sandbox.XMLHttpRequest.prototype.open;
  const originalSend = sandbox.XMLHttpRequest.prototype.send;

  sandbox.__emitMessage({
    origin: IG_ORIGIN,
    data: { type: 'SBE_CAPTURE_CONTROL', action: 'start' }
  });

  assert.notEqual(sandbox.window.fetch, originalFetch, 'fetch should now be wrapped');
  assert.notEqual(sandbox.XMLHttpRequest.prototype.open, originalOpen);
  assert.notEqual(sandbox.XMLHttpRequest.prototype.send, originalSend);
  assert.equal(exposed.active, true);

  sandbox.__emitMessage({
    origin: IG_ORIGIN,
    data: { type: 'SBE_CAPTURE_CONTROL', action: 'stop' }
  });

  assert.equal(sandbox.window.fetch, originalFetch, 'fetch must be restored exactly');
  assert.equal(sandbox.XMLHttpRequest.prototype.open, originalOpen);
  assert.equal(sandbox.XMLHttpRequest.prototype.send, originalSend);
  assert.equal(exposed.active, false);
  assert.equal(exposed.installed, false);
});

test('capture-hook.js: stop leaves a third party\'s later wrapper alone', () => {
  // If something else replaced fetch after us, blindly restoring our saved
  // original would clobber their wrapper. We must leave it in place.
  const { exposed, sandbox } = loadCaptureHook();
  sandbox.__emitMessage({
    origin: IG_ORIGIN,
    data: { type: 'SBE_CAPTURE_CONTROL', action: 'start' }
  });

  const foreign = function foreignFetch() {};
  sandbox.window.fetch = foreign;

  sandbox.__emitMessage({
    origin: IG_ORIGIN,
    data: { type: 'SBE_CAPTURE_CONTROL', action: 'stop' }
  });

  assert.equal(sandbox.window.fetch, foreign,
    "another extension's wrapper must survive our teardown");
  assert.equal(exposed.active, false, 'our wrapper is inert either way');
});

test('capture-hook.js: start is idempotent (double Start does not double-wrap)', () => {
  const { sandbox } = loadCaptureHook();
  const start = {
    origin: IG_ORIGIN,
    data: { type: 'SBE_CAPTURE_CONTROL', action: 'start' }
  };
  sandbox.__emitMessage(start);
  const firstWrapper = sandbox.window.fetch;
  sandbox.__emitMessage(start);
  assert.equal(sandbox.window.fetch, firstWrapper,
    'second Start must not wrap the wrapper');
});

// ---------------------------------------------------------------------------
// Clear All Data
// ---------------------------------------------------------------------------

test('content.js: CLEAR-shaped storage change wipes in-memory state', () => {
  const { exposed, sandbox } = loadContent((s) => { s.chrome.runtime.id = 'test-id'; });
  exposed.startCapture();
  sandbox.__emitMessage(mediaEvent(sandbox, [
    { type: 'image', url: CDN, thumbnail: null, context: null }
  ]));
  assert.equal(exposed.state.images.length, 1, 'precondition: one item stored');

  sandbox.chrome.storage.onChanged._emit(
    { igExporterData: { newValue: { images: [], videos: [] } } }, 'local');

  assert.equal(exposed.state.images.length, 0, 'Clear All must empty images');
  assert.equal(exposed.state.videos.length, 0, 'Clear All must empty videos');
  assert.equal(exposed.state.seenUrls.size, 0,
    'dedup set must reset too, or re-capture is silently blocked');
});
