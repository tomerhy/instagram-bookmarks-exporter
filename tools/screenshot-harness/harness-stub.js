/*
 * Screenshot-harness stub. NOT part of the extension; never packaged.
 *
 * Provides the small chrome.* surface popup.js and gallery.js actually use,
 * backed by an in-memory store seeded from seed-library.json. See README.md in
 * this directory for exactly what is substituted and why.
 */
(function () {
  'use strict';

  var SEED = window.__HARNESS_SEED__ || { images: [], videos: [] };
  var store = {
    igExporterData: { images: SEED.images || [], videos: SEED.videos || [] },
    igExporterLastSeenAt: Date.now(),
    sbeLegacyCleanupAt: Date.now()
  };
  // Consent is deliberately absent unless the query string asks for it, so the
  // first-run disclosure can be screenshotted.
  if (!/[?&]consent=0(&|$)/.test(location.search)) {
    store.sbeConsentAcceptedAt = Date.now();
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  var listeners = [];

  window.chrome = {
    runtime: {
      lastError: null,
      getManifest: function () {
        return { version: '4.4.5', name: 'Saved Posts Library & Export' };
      },
      getURL: function (p) { return location.origin + '/' + p; },
      sendMessage: function (_m, cb) { if (cb) cb({ ok: true }); },
      onMessage: { addListener: function () {} }
    },
    storage: {
      local: {
        get: function (keys, cb) {
          var out = {};
          if (keys === null || keys === undefined) {
            out = clone(store);
          } else if (typeof keys === 'string') {
            if (keys in store) out[keys] = clone(store[keys]);
          } else if (Array.isArray(keys)) {
            keys.forEach(function (k) {
              if (k in store) out[k] = clone(store[k]);
            });
          } else {
            Object.keys(keys).forEach(function (k) {
              out[k] = (k in store) ? clone(store[k]) : keys[k];
            });
          }
          setTimeout(function () { cb && cb(out); }, 0);
        },
        set: function (obj, cb) {
          var changes = {};
          Object.keys(obj).forEach(function (k) {
            changes[k] = { oldValue: store[k], newValue: obj[k] };
            store[k] = clone(obj[k]);
          });
          setTimeout(function () {
            cb && cb();
            listeners.forEach(function (fn) { fn(changes, 'local'); });
          }, 0);
        },
        remove: function (keys, cb) {
          (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
            delete store[k];
          });
          setTimeout(function () { cb && cb(); }, 0);
        },
        clear: function (cb) { store = {}; setTimeout(function () { cb && cb(); }, 0); }
      },
      onChanged: { addListener: function (fn) { listeners.push(fn); } }
    },
    tabs: {
      // Pretend the active tab is an Instagram saved-posts page so the popup
      // renders its capture controls rather than the "open Instagram" screen.
      query: function (_q, cb) {
        cb([{ id: 1, url: 'https://www.instagram.com/example_account/saved/' }]);
      },
      // Stands in for content.js. The only behaviour that matters for the
      // screenshots is that START_CAPTURE refuses with 'consent_required' when
      // no consent timestamp is stored — that is what raises the first-run
      // disclosure, exactly as the real content script does.
      sendMessage: function (_id, msg, cb) {
        if (!cb) return;
        var type = msg && (msg.type || msg.action);
        if (type === 'GET_STATS') {
          cb({
            ok: true,
            images: store.igExporterData.images.length,
            videos: store.igExporterData.videos.length,
            capturing: false
          });
        } else if (type === 'START_CAPTURE' && !store.sbeConsentAcceptedAt) {
          cb({ ok: false, reason: 'consent_required' });
        } else {
          cb({
            ok: true,
            images: store.igExporterData.images.length,
            videos: store.igExporterData.videos.length
          });
        }
      },
      create: function (o) { window.open(o.url, '_blank', 'noopener'); }
    },
    action: { setBadgeText: function () {}, setBadgeBackgroundColor: function () {} }
  };
})();
