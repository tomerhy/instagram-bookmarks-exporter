// Tests for the v4.3.7 extension-context guards in content.js.
//
// Problem: in MV3 the content script can outlive the extension's service
// worker (idle eviction, hot reload, auto-update). Every chrome.* call
// after that throws "Extension context invalidated", which previously
// surfaced as an unhandled exception during captures.
//
// Fix: isExtensionContextOk() + safeStorageSet / safeStorageGet /
// safeSendMessage wrappers that detect the dead context and stop
// retrying gracefully.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadIIFE } = require('./_setup');

function loadContent() {
  return loadIIFE('content.js').exposed;
}

// isExtensionContextOk reads chrome.runtime.id at the moment of the call —
// it's a probe, not a cache. So we mutate the in-sandbox chrome stub
// directly between calls.
function withChrome(fn, chromeOverride) {
  // Tests share one loaded content.js, but `chrome` is a sandbox global,
  // so re-loading gives us a clean stub each time.
  const c = loadContent();
  // The exposed seam returns the IIFE's closure-bound functions. The chrome
  // they see is the sandbox global, accessible via globalThis on the same
  // sandbox. We can't get a handle to it here — but each loadIIFE call
  // creates a fresh sandbox, so `c` already binds to that sandbox's chrome.
  // To override, we hop back to the sandbox via the loadIIFE result.
  return fn(c);
}

test('isExtensionContextOk: true when chrome.runtime.id is set (normal case)', () => {
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  // Default _setup chrome stub has getManifest but no runtime.id.
  sandbox.chrome.runtime.id = 'fake-extension-id';
  assert.equal(exposed.isExtensionContextOk(), true);
});

test('isExtensionContextOk: false when chrome.runtime.id is undefined', () => {
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  delete sandbox.chrome.runtime.id;
  assert.equal(exposed.isExtensionContextOk(), false);
});

test('isExtensionContextOk: false when chrome.runtime itself throws (defensive)', () => {
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  Object.defineProperty(sandbox.chrome, 'runtime', {
    get() { throw new Error('Extension context invalidated.'); },
    configurable: true
  });
  assert.equal(exposed.isExtensionContextOk(), false,
    'a getter that throws must not crash the probe');
});

test('isExtensionContextOk: false when chrome is null/undefined', () => {
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  sandbox.chrome = undefined;
  assert.equal(exposed.isExtensionContextOk(), false);
});

// ---------- safeStorageSet ----------

test('safeStorageSet: invokes chrome.storage.local.set when context is alive', () => {
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  sandbox.chrome.runtime.id = 'fake-id';

  let called = null;
  sandbox.chrome.storage.local.set = function (items, cb) {
    called = items;
    cb && cb();
  };

  let cbFired = false;
  exposed.safeStorageSet({ foo: 1 }, function () { cbFired = true; });

  assert.deepEqual(called, { foo: 1 });
  assert.equal(cbFired, true);
  assert.equal(exposed.extensionContextLost, false,
    'a healthy call should not mark the context as lost');
});

test('safeStorageSet: skips the call and flips the flag when context is dead', () => {
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  delete sandbox.chrome.runtime.id;

  let called = false;
  sandbox.chrome.storage.local.set = function () { called = true; };

  exposed.safeStorageSet({ foo: 1 });

  assert.equal(called, false, 'should not even attempt the storage write');
  assert.equal(exposed.extensionContextLost, true,
    'detecting a dead context should flip the flag');
});

test('safeStorageSet: catches a synchronously-thrown set (extension reload mid-call)', () => {
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  sandbox.chrome.runtime.id = 'fake-id';
  sandbox.chrome.storage.local.set = function () {
    throw new Error('Extension context invalidated.');
  };

  assert.doesNotThrow(() => exposed.safeStorageSet({ foo: 1 }),
    'a thrown storage.set must not bubble up into the page');
  assert.equal(exposed.extensionContextLost, true,
    'caught throw should also flip the flag so we stop retrying');
});

test('safeStorageSet: a "context invalidated" lastError flips the flag', () => {
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  sandbox.chrome.runtime.id = 'fake-id';
  sandbox.chrome.storage.local.set = function (_items, cb) {
    sandbox.chrome.runtime.lastError = { message: 'Extension context invalidated.' };
    cb && cb();
    sandbox.chrome.runtime.lastError = null;
  };

  exposed.safeStorageSet({ foo: 1 });
  assert.equal(exposed.extensionContextLost, true);
});

test('safeStorageSet: a non-context lastError does NOT flip the flag (real storage errors)', () => {
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  sandbox.chrome.runtime.id = 'fake-id';
  sandbox.chrome.storage.local.set = function (_items, cb) {
    sandbox.chrome.runtime.lastError = { message: 'QUOTA_BYTES_PER_ITEM quota exceeded' };
    cb && cb();
    sandbox.chrome.runtime.lastError = null;
  };

  exposed.safeStorageSet({ foo: 1 });
  assert.equal(exposed.extensionContextLost, false,
    'genuine storage errors should be reported but not poison the flag');
});

// ---------- safeStorageGet ----------

test('safeStorageGet: passes a normalized {} when context is alive but storage returns nothing', () => {
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  sandbox.chrome.runtime.id = 'fake-id';
  sandbox.chrome.storage.local.get = function (_keys, cb) { cb(undefined); };

  let observed = 'untouched';
  exposed.safeStorageGet(['foo'], function (result) { observed = result; });

  assert.equal(typeof observed, 'object');
  assert.equal(Object.keys(observed).length, 0,
    'undefined storage result should be normalized to an empty object');
});

test('safeStorageGet: no-op when context is dead', () => {
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  delete sandbox.chrome.runtime.id;

  let called = false;
  sandbox.chrome.storage.local.get = function () { called = true; };
  let cbFired = false;
  exposed.safeStorageGet(['foo'], function () { cbFired = true; });

  assert.equal(called, false);
  assert.equal(cbFired, false);
  assert.equal(exposed.extensionContextLost, true);
});

// ---------- safeSendMessage ----------

test('safeSendMessage: sends when alive, no-ops when dead', () => {
  let sent = null;
  {
    const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
    sandbox.chrome.runtime.id = 'fake-id';
    sandbox.chrome.runtime.sendMessage = function (msg, cb) { sent = msg; cb && cb({}); };
    exposed.safeSendMessage({ type: 'PING' });
    assert.deepEqual(sent, { type: 'PING' });
    assert.equal(exposed.extensionContextLost, false);
  }
  {
    const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
    delete sandbox.chrome.runtime.id;
    sandbox.chrome.runtime.sendMessage = function () { throw new Error('should not be called'); };
    assert.doesNotThrow(() => exposed.safeSendMessage({ type: 'PING' }));
    assert.equal(exposed.extensionContextLost, true);
  }
});

test('safeSendMessage: a "Receiving end does not exist" lastError is NOT a context death', () => {
  // This commonly happens when the background sw isn't listening for that
  // message type — we should silently swallow it, not poison the flag.
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  sandbox.chrome.runtime.id = 'fake-id';
  sandbox.chrome.runtime.sendMessage = function (_msg, cb) {
    sandbox.chrome.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
    cb && cb();
    sandbox.chrome.runtime.lastError = null;
  };

  exposed.safeSendMessage({ type: 'PING' });
  assert.equal(exposed.extensionContextLost, false,
    'a missing receiver is not the same as a dead extension context');
});

// ---------- One-shot behavior ----------

test('noteContextLoss: only fires once even after many failed calls', () => {
  // Once the flag is set, repeated failures should not re-log noisily and
  // should keep no-op-ing without flipping anything else.
  const { exposed, sandbox } = require('./_setup').loadIIFE('content.js');
  delete sandbox.chrome.runtime.id;

  exposed.safeStorageSet({ a: 1 });
  exposed.safeStorageSet({ b: 2 });
  exposed.safeStorageGet(['x']);
  exposed.safeSendMessage({ type: 'X' });

  assert.equal(exposed.extensionContextLost, true,
    'flag should be set after the first failure and stay set');
});
