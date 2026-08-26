/*
 * Screenshot-harness only. Additively widens the media-URL check so the
 * locally generated placeholder tiles render instead of broken-image glyphs.
 *
 * The shipped url-allowlist.js is NOT edited and its own function is still
 * called first — this only adds "…or a tile served by this harness on
 * 127.0.0.1". Nothing here reaches the extension: this file is not in the
 * manifest, not in build.sh's file list, and not in the packaged ZIP.
 */
(function () {
  'use strict';
  var U = globalThis.SBE_URL;
  if (!U) return;
  var LOCAL = /^http:\/\/127\.0\.0\.1:\d+\/media\/[A-Za-z0-9._-]+$/;
  var realMedia = U.isAllowedMediaUrl;
  var realAny = U.isAllowedUrl;
  U.isAllowedMediaUrl = function (v) {
    return realMedia(v) || LOCAL.test(String(v));
  };
  U.isAllowedUrl = function (v) {
    return realAny(v) || LOCAL.test(String(v));
  };
})();
