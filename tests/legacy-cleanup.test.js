// Phase 2 evidence: state left behind by the removed Google Analytics client
// and the removed autoplay feature is actively deleted, not merely orphaned.
//
// Uninstalling code stops new writes; it does not remove the persistent
// analytics client ID already sitting in the profile of every user who ran
// 4.4.0 or earlier. legacy-cleanup.js is what makes "no persistent identifier"
// true for existing installs rather than only for fresh ones.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadIIFE } = require('./_setup');

// A Web Storage stub that records reads, writes and removals.
function makeStorage(initial) {
  const data = Object.assign({}, initial);
  const removed = [];
  return {
    data,
    removed,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { removed.push(k); delete data[k]; }
  };
}

function run(opts) {
  opts = opts || {};
  const local = makeStorage(opts.local);
  const session = makeStorage(opts.session);
  const extRemoved = [];
  const extWrites = [];
  const { exposed, sandbox } = loadIIFE('legacy-cleanup.js', {
    setup: (s) => {
      s.localStorage = local;
      s.sessionStorage = session;
      s.chrome.runtime.id = 'test-id';
      s.chrome.storage.local.remove = (keys, cb) => {
        extRemoved.push(...(Array.isArray(keys) ? keys : [keys]));
        if (cb) cb();
      };
      s.chrome.storage.local.get = (_keys, cb) => cb(opts.extStored || {});
      s.chrome.storage.local.set = (items, cb) => { extWrites.push(items); if (cb) cb(); };
    }
  });
  return { exposed, sandbox, local, session, extRemoved, extWrites };
}

test('removes the persistent GA client ID from localStorage', () => {
  const r = run({ local: { ga_client_id: 'abc123xyz', ga_debug: '1' } });
  assert.equal(r.local.getItem('ga_client_id'), null);
  assert.equal(r.local.getItem('ga_debug'), null);
  assert.ok(r.local.removed.includes('ga_client_id'));
  assert.ok(r.local.removed.includes('ga_debug'));
});

test('removes the GA session ID from sessionStorage', () => {
  const r = run({ session: { ga_session_id: '1700000000000' } });
  assert.equal(r.session.getItem('ga_session_id'), null);
  assert.ok(r.session.removed.includes('ga_session_id'));
});

test('removes the autoplay preferences from extension storage', () => {
  const r = run();
  assert.ok(r.extRemoved.includes('igAutoplayEnabled'));
  assert.ok(r.extRemoved.includes('igAutoplayMuted'));
});

test('removes the popup-use counter and donation-dismissal flag (4.4.3)', () => {
  // These backed the threshold-triggered donation banner, which counted popup
  // opens. That is user-activity tracking the single purpose did not need, so
  // 4.4.3 removed the feature and deletes its keys from existing installs.
  const r = run();
  assert.ok(r.extRemoved.includes('useCount'),
    'useCount must be deleted, not merely orphaned');
  assert.ok(r.extRemoved.includes('supportDismissed'));
});

test('the removed-key list is exactly the four documented keys', () => {
  const r = run();
  assert.deepEqual(r.extRemoved.slice().sort(), [
    'igAutoplayEnabled', 'igAutoplayMuted', 'supportDismissed', 'useCount'
  ]);
});

test('does not touch keys it does not own', () => {
  const r = run({
    local: { ga_client_id: 'x', somethingElse: 'keep-me' },
    session: { ga_session_id: 'y', alsoKeep: 'keep-me' }
  });
  assert.equal(r.local.getItem('somethingElse'), 'keep-me');
  assert.equal(r.session.getItem('alsoKeep'), 'keep-me');
  assert.deepEqual(r.local.removed.sort(), ['ga_client_id', 'ga_debug']);
});

test('is idempotent — a second run on a clean profile removes nothing new', () => {
  // exposed.removed is constructed inside the vm context, so copy it into a
  // host array before comparing: deepStrictEqual also checks the prototype.
  const first = run({ local: { ga_client_id: 'x' } });
  assert.deepEqual([...first.exposed.removed], ['localStorage.ga_client_id']);
  const second = run();  // nothing left to find
  assert.deepEqual([...second.exposed.removed], [],
    'a clean profile should report no removals');
});

test('records the completion marker exactly once', () => {
  const first = run();
  assert.equal(first.extWrites.length, 1, 'first run stamps the marker');
  assert.ok('sbeLegacyCleanupAt' in first.extWrites[0]);
  assert.equal(typeof first.extWrites[0].sbeLegacyCleanupAt, 'number');

  // With the marker already present, no second write happens.
  const second = run({ extStored: { sbeLegacyCleanupAt: 1700000000000 } });
  assert.deepEqual(second.extWrites, [],
    'the marker must not be rewritten on later page loads');
});

test('survives Web Storage being unavailable', () => {
  const throwing = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('SecurityError'); },
    removeItem: () => { throw new Error('SecurityError'); }
  };
  assert.doesNotThrow(() => {
    loadIIFE('legacy-cleanup.js', {
      setup: (s) => {
        s.localStorage = throwing;
        s.sessionStorage = throwing;
        s.chrome.runtime.id = 'test-id';
      }
    });
  }, 'a storage SecurityError must not break the popup');
});

test('survives the extension context being gone', () => {
  assert.doesNotThrow(() => {
    loadIIFE('legacy-cleanup.js', {
      setup: (s) => {
        s.localStorage = makeStorage({ ga_client_id: 'x' });
        s.sessionStorage = makeStorage();
        s.chrome = undefined;   // service worker evicted / extension reloaded
      }
    });
  }, 'a dead extension context must not break the page');
});

test('the cleanup runs on both extension pages', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '..');
  for (const page of ['popup.html', 'gallery.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.ok(html.includes('<script src="legacy-cleanup.js"></script>'),
      page + ' must load legacy-cleanup.js');
  }
});
