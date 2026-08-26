// Shared test setup: a browser-shaped sandbox plus loaders that run real
// extension source via vm.runInContext. The IIFE files (injector.js,
// content.js) expose internals through a tiny gated test seam at their tail;
// gallery.js is top-level so its functions land directly on the sandbox.
//
// These tests run against the actual production source — no mirroring or
// copying. The seam is a no-op in the browser (gated on a global flag).

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');

function makeNodeList(arr) {
  const list = (arr || []).slice();
  // Preserve forEach so `document.querySelectorAll(...).forEach(...)` works.
  list.forEach = Array.prototype.forEach.bind(list);
  return list;
}

function makeElement() {
  const el = {
    style: {},
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false
    },
    dataset: {},
    children: [],
    parentNode: null,
    parentElement: null,
    appendChild: function(c) { this.children.push(c); return c; },
    removeChild: () => {},
    insertBefore: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    querySelector: () => null,
    querySelectorAll: () => makeNodeList([]),
    setAttribute: () => {},
    getAttribute: () => null,
    closest: () => null,
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    scrollIntoView: () => {},
    click: () => {},
    remove: () => {},
    focus: () => {},
    blur: () => {},
    pause: () => {},
    play: () => Promise.resolve(),
    load: () => {},
    _innerHTML: ''
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._innerHTML; },
    set(v) { this._innerHTML = v; }
  });
  return el;
}

function makeChromeStub() {
  // Listener registries are tracked so tests can simulate Chrome events
  // (storage changes, runtime install/startup). The _emit helpers are
  // test-only — chrome's real API doesn't expose them.
  const onChangedListeners = [];
  const onInstalledListeners = [];
  const onStartupListeners = [];

  // Capture the latest badge state so tests can assert on it without
  // having to spy on every call site.
  const badgeState = { text: null, color: null, calls: [] };

  return {
    storage: {
      local: {
        set: (_data, cb) => cb && cb(),
        get: (_keys, cb) => cb && cb({}),
        remove: (_keys, cb) => cb && cb()
      },
      onChanged: {
        addListener: (fn) => onChangedListeners.push(fn),
        _emit: (changes, area) => {
          for (const fn of onChangedListeners) {
            try { fn(changes, area); } catch (e) { /* test isolation */ }
          }
        }
      }
    },
    runtime: {
      onMessage: { addListener: () => {} },
      onInstalled: {
        addListener: (fn) => onInstalledListeners.push(fn),
        _emit: () => onInstalledListeners.forEach(fn => { try { fn(); } catch (e) {} })
      },
      onStartup: {
        addListener: (fn) => onStartupListeners.push(fn),
        _emit: () => onStartupListeners.forEach(fn => { try { fn(); } catch (e) {} })
      },
      lastError: null,
      getManifest: () => ({ version: '4.3.0' }),
      sendMessage: () => {},
      getURL: (p) => 'chrome-extension://test/' + p
    },
    tabs: {
      query: (_q, cb) => cb && cb([]),
      sendMessage: () => {},
      create: () => {}
    },
    action: {
      setBadgeText: (opts) => { badgeState.text = (opts && opts.text); badgeState.calls.push({ kind: 'text', value: badgeState.text }); },
      setBadgeBackgroundColor: (opts) => { badgeState.color = (opts && opts.color); badgeState.calls.push({ kind: 'color', value: badgeState.color }); },
      _badgeState: badgeState
    }
  };
}

// Build a sandbox that looks enough like a browser to load any of the
// extension's scripts at top level without exploding. Mocks are deliberately
// dumb — production code paths that touch the DOM are not exercised by these
// tests; we only call the pure helpers exposed via test seams (or, for
// gallery.js, directly accessible top-level functions).
function makeBrowserSandbox() {
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    URL, URLSearchParams,  // not auto-injected into vm contexts; needed by normalizeUrl
    fetch: async () => ({ clone: () => ({ text: async () => '{}' }), ok: true, text: async () => '{}' }),
    XMLHttpRequest: function XMLHttpRequest() {},
    MutationObserver: function MutationObserver() { this.observe = () => {}; this.disconnect = () => {}; },
    IntersectionObserver: function IntersectionObserver() { this.observe = () => {}; this.unobserve = () => {}; this.disconnect = () => {}; },
    Node: { ELEMENT_NODE: 1 },
    KeyboardEvent: function KeyboardEvent() {},
    MouseEvent: function MouseEvent() {},
    Event: function Event() {},
    sessionStorage: { getItem: () => null, setItem: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    chrome: makeChromeStub(),
    document: {
      // Keep readyState !== 'complete' so init handlers attach to a 'load'
      // listener we never fire — top-level eager init never runs.
      readyState: 'loading',
      hidden: false,
      head: { appendChild: () => {} },
      // The capture loop reads scrollHeight to decide whether it has reached
      // the end of the feed. A tiny value makes it conclude "at the bottom"
      // immediately, so tests don't sit through the scroll driver.
      documentElement: { scrollHeight: 100 },
      body: makeElement(),
      createElement: () => makeElement(),
      querySelector: () => null,
      querySelectorAll: () => makeNodeList([]),
      getElementById: () => null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {}
    },
    __SBE_TEST_HOOKS__: {}
  };

  // XMLHttpRequest.prototype is monkey-patched by injector.js / content.js.
  sandbox.XMLHttpRequest.prototype = {
    open: function() {},
    send: function() {},
    addEventListener: function() {}
  };

  // The window object — many code paths reference window.X explicitly even
  // though they're already globals in the browser.
  sandbox.window = sandbox;
  sandbox.window.location = { href: 'https://www.instagram.com/saved/', pathname: '/saved/' };
  sandbox.window.history = { back: () => {} };
  sandbox.window.scrollY = 0;
  sandbox.window.innerHeight = 800;
  sandbox.window.scrollTo = () => {};
  sandbox.window.getComputedStyle = () => ({ position: 'static' });
  // Recording postMessage + a real listener registry, so tests can drive the
  // window 'message' channel and assert on what the code posts back.
  sandbox.__posted = [];
  sandbox.__messageListeners = [];
  sandbox.window.postMessage = (data, origin) => {
    sandbox.__posted.push({ data, origin });
  };
  sandbox.window.addEventListener = (type, fn) => {
    if (type === 'message') sandbox.__messageListeners.push(fn);
  };
  sandbox.window.dispatchEvent = () => {};
  // Deliver a synthetic message event to every registered listener.
  //
  // `source` defaults to __window — the contextified global as the *sandboxed
  // code* sees it. That is not the same object as this host-side `sandbox`, so
  // a test that passed `sandbox.window` by hand would fail the production
  // `event.source !== window` check for the wrong reason. __window is
  // populated by loadIIFE / loadTopLevel once the context exists.
  sandbox.__emitMessage = (event) => {
    const ev = Object.assign({ source: sandbox.__window }, event);
    if (ev.source === undefined) ev.source = sandbox.__window;
    for (const fn of sandbox.__messageListeners) fn(ev);
  };
  sandbox.__window = null;

  return sandbox;
}

// Run an IIFE source file (capture-hook.js, content.js) and return whatever
// its test seam exposed.
//
// opts.deps    — source files to evaluate in the same context first. Both
//                content scripts depend on url-allowlist.js being loaded
//                ahead of them, exactly as the manifest declares.
// opts.setup   — called with the sandbox before anything is evaluated.
function loadIIFE(filename, opts) {
  opts = opts || {};
  const sandbox = makeBrowserSandbox();
  if (typeof opts.setup === 'function') opts.setup(sandbox);
  vm.createContext(sandbox);
  sandbox.__window = vm.runInContext('globalThis', sandbox);
  for (const dep of opts.deps || []) {
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, dep), 'utf8'), sandbox, { filename: dep });
  }
  const source = fs.readFileSync(path.join(REPO_ROOT, filename), 'utf8');
  vm.runInContext(source, sandbox, { filename });
  const seamKey = path.basename(filename, '.js');
  const exposed = sandbox.__SBE_TEST_HOOKS__[seamKey];
  if (!exposed) {
    throw new Error(
      'Test seam not found for ' + filename + '. Did you forget to add the ' +
      '__SBE_TEST_HOOKS__ block at the end of the IIFE?'
    );
  }
  return { exposed, sandbox };
}

// Run a top-level (non-IIFE) source file and return the sandbox so tests can
// poke at any top-level binding.
//
// deps are evaluated first, in order, in the same context — used to mirror the
// <script> order a page actually declares.
function loadTopLevel(filename, extraSetup, deps) {
  const source = fs.readFileSync(path.join(REPO_ROOT, filename), 'utf8');
  const sandbox = makeBrowserSandbox();
  if (typeof extraSetup === 'function') extraSetup(sandbox);
  vm.createContext(sandbox);
  sandbox.__window = vm.runInContext('globalThis', sandbox);
  for (const dep of deps || []) {
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, dep), 'utf8'), sandbox, { filename: dep });
  }
  vm.runInContext(source, sandbox, { filename });
  return sandbox;
}

// content.js and capture-hook.js are both declared in the manifest with
// url-allowlist.js ahead of them; mirror that here so tests exercise the same
// wiring the browser does.
// Mirror the manifest / page <script> order exactly:
//   MAIN world      : url-allowlist.js, capture-hook.js
//   isolated world  : url-allowlist.js, library-sanitize.js, content.js
//   gallery.html    : url-allowlist.js, library-sanitize.js, gallery.js
const ALLOWLIST_ONLY = ['url-allowlist.js'];
const ALLOWLIST_AND_SANITIZER = ['url-allowlist.js', 'library-sanitize.js'];

function loadContent(setup) {
  return loadIIFE('content.js', { deps: ALLOWLIST_AND_SANITIZER, setup });
}

function loadCaptureHook(setup) {
  return loadIIFE('capture-hook.js', { deps: ALLOWLIST_ONLY, setup });
}

function loadGallery(setup) {
  return loadTopLevel('gallery.js', setup, ALLOWLIST_AND_SANITIZER);
}

module.exports = {
  makeBrowserSandbox,
  loadIIFE,
  loadContent,
  loadCaptureHook,
  loadGallery,
  loadTopLevel,
  REPO_ROOT
};
