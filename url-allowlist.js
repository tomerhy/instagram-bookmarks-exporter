/**
 * Shared URL allowlist — the single place that decides whether a URL is
 * allowed to enter the extension's data store, be rendered, or be fetched.
 *
 * Loaded into three separate contexts, all of which need the same answer:
 *   - the MAIN-world capture script  (manifest content_scripts, MAIN world)
 *   - the isolated-world content script (manifest content_scripts)
 *   - the gallery page (<script> in gallery.html)
 *
 * Everything is exposed on `globalThis.SBE_URL`. The MAIN-world copy shares a
 * global namespace with the page, so the page can see and tamper with it —
 * that copy is a convenience filter only. The authoritative checks are the
 * ones performed in the isolated world (content.js) and on the gallery page,
 * neither of which the page can reach.
 *
 * Design rule: allow only `https:` and only hosts we actually need. Anything
 * else — javascript:, data:, blob:, file:, chrome-extension:, http:, IP
 * literals, localhost, arbitrary third parties — is rejected. There is no
 * "unknown but probably fine" branch.
 */
(function () {
  'use strict';

  // Hosts that serve the media bytes themselves. Instagram/Meta CDN only.
  // Matched as an exact host or as a subdomain (".suffix") — never a bare
  // `endsWith` on the whole string, which "evilcdninstagram.com" would pass.
  var MEDIA_HOST_SUFFIXES = [
    'cdninstagram.com',
    'fbcdn.net'
  ];

  // Hosts that serve post permalinks (postUrl). Exact matches only.
  var POST_HOSTS = [
    'www.instagram.com',
    'instagram.com'
  ];

  // Hard ceilings. A URL longer than this is not a real CDN URL; it is either
  // corruption or someone trying to stuff a payload through a string field.
  var MAX_URL_LENGTH = 2048;

  function parse(value) {
    if (typeof value !== 'string') return null;
    if (!value || value.length > MAX_URL_LENGTH) return null;
    // Reject whitespace and C0/C1 control characters outright — the URL
    // parser strips or tolerates some of them and we do not want to depend
    // on which. Hyphens, dots and percent-escapes are of course fine.
    if (/[\s\u0000-\u001f\u007f]/.test(value)) return null;
    // Reject characters that only ever appear in a URL string because someone
    // is trying to break out of an HTML attribute or inject markup. A real CDN
    // URL never contains a literal <, >, quote or backslash — those would be
    // percent-encoded. Checking the RAW string matters: new URL() silently
    // percent-encodes them, so parsing first and inspecting the result would
    // let the original hostile string through to the clipboard and the exports.
    if (/[<>"'`\\]/.test(value)) return null;
    var u;
    try {
      u = new URL(value);
    } catch (_) {
      return null;
    }
    if (u.protocol !== 'https:') return null;
    // Credentials embedded in the URL are never legitimate here.
    if (u.username || u.password) return null;
    return u;
  }

  function hostMatchesSuffix(host, suffix) {
    return host === suffix || host.endsWith('.' + suffix);
  }

  // Is this a URL we are willing to store as, and later fetch as, media —
  // i.e. assign to img.src / video.src / player.src, or hand to fetch()?
  //
  // CDN hosts ONLY. instagram.com is deliberately excluded even though it is
  // allowlisted for permalinks: a permalink is an HTML page, not media, and
  // 4.4.1 accepting it here produced a real type confusion in which a
  // post URL could be assigned to player.src. Media and pages are now
  // strictly separate namespaces.
  function isAllowedMediaUrl(value) {
    var u = parse(value);
    if (!u) return false;
    var host = u.hostname.toLowerCase();
    for (var i = 0; i < MEDIA_HOST_SUFFIXES.length; i++) {
      if (hostMatchesSuffix(host, MEDIA_HOST_SUFFIXES[i])) return true;
    }
    return false;
  }

  // Is this a URL we are willing to store as a post permalink and later open
  // in a new tab?
  function isAllowedPostUrl(value) {
    var u = parse(value);
    if (!u) return false;
    return POST_HOSTS.indexOf(u.hostname.toLowerCase()) !== -1;
  }

  // Convenience for callers that want either flavour (e.g. the gallery grid,
  // which renders thumbnails that may be CDN or permalink hosted).
  function isAllowedUrl(value) {
    return isAllowedMediaUrl(value) || isAllowedPostUrl(value);
  }

  var api = {
    isAllowedMediaUrl: isAllowedMediaUrl,
    isAllowedPostUrl: isAllowedPostUrl,
    isAllowedUrl: isAllowedUrl,
    MAX_URL_LENGTH: MAX_URL_LENGTH,
    MEDIA_HOST_SUFFIXES: MEDIA_HOST_SUFFIXES.slice(),
    POST_HOSTS: POST_HOSTS.slice()
  };

  globalThis.SBE_URL = api;

  // Test seam: only fires when tests set __SBE_TEST_HOOKS__ before loading
  // the source. No effect in the browser.
  if (globalThis.__SBE_TEST_HOOKS__) {
    globalThis.__SBE_TEST_HOOKS__['url-allowlist'] = api;
  }
})();
