/**
 * One-time removal of state left behind by features that no longer exist.
 *
 * Versions up to 4.4.0 shipped a Google Analytics 4 Measurement Protocol
 * client (analytics.js) and an unrelated video-autoplay feature. Both were
 * removed in 4.4.1. Uninstalling the code stops new writes, but users who ran
 * an earlier build still have the old values sitting in their profile:
 *
 *   localStorage   ga_client_id   persistent pseudonymous analytics ID
 *   localStorage   ga_debug       analytics debug opt-in flag
 *   sessionStorage ga_session_id  per-session analytics ID
 *   chrome.storage igAutoplayEnabled / igAutoplayMuted   autoplay prefs
 *   chrome.storage useCount / supportDismissed           popup-use counter
 *
 * This file deletes them. It is loaded first by popup.html and gallery.html —
 * the only two pages in the extension origin, and therefore the only places
 * that Web Storage was ever written.
 *
 * The removals are unconditional because they are idempotent and cost
 * nothing: after the first run there is nothing left to delete. The
 * `sbeLegacyCleanupAt` marker records when the sweep first completed so the
 * behaviour is auditable, and is the only thing written back.
 */
(function () {
  'use strict';

  var LOCAL_STORAGE_KEYS = ['ga_client_id', 'ga_debug'];
  var SESSION_STORAGE_KEYS = ['ga_session_id'];
  // igAutoplay* : the autoplay feature removed in 4.4.1.
  // useCount / supportDismissed : the popup-use counter and donation-banner
  //   dismissal flag removed in 4.4.3. Counting popup opens to trigger a
  //   donation prompt was user-activity tracking that the extension's single
  //   purpose did not need, so the keys are deleted rather than orphaned.
  var EXTENSION_STORAGE_KEYS = ['igAutoplayEnabled', 'igAutoplayMuted',
                                'useCount', 'supportDismissed'];
  var MARKER_KEY = 'sbeLegacyCleanupAt';

  var removed = [];

  // Web Storage: wrapped individually so a SecurityError on one API (e.g.
  // storage disabled by policy) cannot stop the other from being cleaned.
  LOCAL_STORAGE_KEYS.forEach(function (key) {
    try {
      if (localStorage.getItem(key) !== null) removed.push('localStorage.' + key);
      localStorage.removeItem(key);
    } catch (_) { /* storage unavailable — nothing to clean */ }
  });

  SESSION_STORAGE_KEYS.forEach(function (key) {
    try {
      if (sessionStorage.getItem(key) !== null) removed.push('sessionStorage.' + key);
      sessionStorage.removeItem(key);
    } catch (_) { /* storage unavailable — nothing to clean */ }
  });

  // Extension storage: async, and only reachable when the extension context
  // is alive. Only write the marker once, so a reader can tell whether the
  // sweep has ever run on this profile.
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(EXTENSION_STORAGE_KEYS, function () {
        void (chrome.runtime && chrome.runtime.lastError);
        chrome.storage.local.get([MARKER_KEY], function (result) {
          if (result && result[MARKER_KEY]) return;
          var stamp = {};
          stamp[MARKER_KEY] = Date.now();
          chrome.storage.local.set(stamp);
        });
      });
    }
  } catch (_) { /* extension context gone — retried on next page load */ }

  if (removed.length) {
    console.log('[Cleanup] Removed legacy keys:', removed.join(', '));
  }

  // Test seam: only fires when tests set __SBE_TEST_HOOKS__ before loading
  // the source. No effect in the browser.
  if (globalThis.__SBE_TEST_HOOKS__) {
    globalThis.__SBE_TEST_HOOKS__['legacy-cleanup'] = {
      LOCAL_STORAGE_KEYS: LOCAL_STORAGE_KEYS.slice(),
      SESSION_STORAGE_KEYS: SESSION_STORAGE_KEYS.slice(),
      EXTENSION_STORAGE_KEYS: EXTENSION_STORAGE_KEYS.slice(),
      MARKER_KEY: MARKER_KEY,
      removed: removed.slice()
    };
  }
})();
