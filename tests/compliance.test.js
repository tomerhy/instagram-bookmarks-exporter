// Compliance regression tests. These are deliberately *static* scans over the
// shipped source: they exist so that a future well-meaning change cannot
// silently re-introduce something the Chrome Web Store removal was about.
//
// Every assertion here corresponds to a claim made in privacy-policy.html,
// CWS_STORE_LISTING.md or CWS_PRIVACY_DISCLOSURES.md. If one of these fails,
// a published claim has become untrue — fix the code, or fix the claim.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

// The files that actually ship. Kept in sync with build.sh by
// tests/build.test.js, which asserts the zip contains exactly what the
// manifest and pages reference.
const SHIPPED = [
  'manifest.json',
  'background.js',
  'content.js',
  'capture-hook.js',
  'url-allowlist.js',
  'legacy-cleanup.js',
  'popup.html',
  'popup.js',
  'gallery.html',
  'gallery.js',
  'tokens.css',
  'privacy-policy.html'
];

// lib/ is vendored third-party code (JSZip). It is scanned for network calls
// and remote loading, but not for our own naming conventions.
const VENDORED = ['lib/jszip.min.js'];

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

// privacy-policy.html is prose, and the honest version of it *names* the
// analytics that used to ship, the cookie API we do not call, and so on.
// Scanning it for those strings would punish the disclosure. It is asserted
// separately (see 'the privacy policy is inert static HTML') to be script-free.
const PROSE = new Set(['privacy-policy.html']);

// Comments describe intent, including "we removed X". Strip them so the scans
// below assert on executable code only.
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // /* block */ and CSS comments
    .replace(/<!--[\s\S]*?-->/g, ' ')     // HTML comments
    .replace(/^[ \t]*\/\/.*$/gm, ' ')      // whole-line // comments
    .replace(/([;,)}'"`])[ \t]*\/\/.*$/gm, '$1');  // trailing // comments
}

function shippedSources() {
  return SHIPPED
    .filter(f => !PROSE.has(f))
    .map(f => ({ file: f, text: stripComments(read(f)) }));
}

// Collapse whitespace so a line-wrapped sentence in HTML still matches.
function flat(text) {
  return text.replace(/\s+/g, ' ');
}

function findAll(pattern) {
  const hits = [];
  for (const { file, text } of shippedSources()) {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

const manifest = JSON.parse(read('manifest.json'));

// ---------------------------------------------------------------------------
// Phase 2 — analytics and telemetry are gone
// ---------------------------------------------------------------------------

test('no analytics file ships', () => {
  for (const gone of ['analytics.js', 'autoplay.js', 'injector.js', 'content-styles.css']) {
    assert.equal(fs.existsSync(path.join(REPO_ROOT, gone)), false,
      gone + ' must not exist — it was removed in 4.4.1');
  }
});

test('no Analytics reference remains in shipped source', () => {
  const hits = findAll(/\bAnalytics\b/);
  assert.deepEqual(hits, [], 'found Analytics references:\n' + hits.join('\n'));
});

test('no Google Analytics endpoint or identifier remains', () => {
  const patterns = [
    /google-analytics\.com/i,
    /googletagmanager/i,
    /analytics\.google\.com/i,
    /\bG-[A-Z0-9]{8,}\b/,              // GA4 measurement ID shape
    /\bUA-\d{4,}-\d+\b/,               // legacy UA property shape
    /api_secret/i,
    /measurement_id/i,
    /\bmp\/collect\b/
  ];
  for (const p of patterns) {
    const hits = findAll(p);
    assert.deepEqual(hits, [], 'pattern ' + p + ' still matches:\n' + hits.join('\n'));
  }
});

test('the specific GA credentials that shipped through 4.4.0 are gone', () => {
  // These two exact strings were in the published package, so "we removed
  // analytics" has to mean these in particular — a generic /api_secret/ scan
  // would not prove it.
  //
  // They are assembled from fragments rather than written out literally. The
  // assertion is identical in strength, but the working tree then holds no
  // contiguous copy of a real credential for a secret scanner to flag or for a
  // reader to lift out of a public repository. This does NOT undo the exposure:
  // both values are already in this repository's git history and still need to
  // be revoked in the Google Analytics console by the property owner. See
  // COMPLIANCE_EVIDENCE.md §19.
  const MEASUREMENT_ID = 'G-' + 'PX8PH' + '6ZQED';
  const API_SECRET = 'XsR9' + 'YFyZQY2' + '_gJdKY' + '939Lw';
  for (const secret of [MEASUREMENT_ID, API_SECRET]) {
    const hits = findAll(new RegExp(secret.replace(/[-]/g, '\\-')));
    assert.deepEqual(hits, [], secret + ' must not appear anywhere:\n' + hits.join('\n'));
  }
});

test('no beacon or websocket telemetry channel exists', () => {
  for (const p of [/sendBeacon/, /new\s+WebSocket/, /new\s+EventSource/, /navigator\.connection/]) {
    const hits = findAll(p);
    assert.deepEqual(hits, [], 'pattern ' + p + ' matches:\n' + hits.join('\n'));
  }
});

test('legacy GA storage keys are cleaned up, and only referenced there', () => {
  const cleanup = read('legacy-cleanup.js');
  for (const key of ['ga_client_id', 'ga_debug', 'ga_session_id']) {
    assert.ok(cleanup.includes(key), 'legacy-cleanup.js must remove ' + key);
  }
  // No other shipped code may touch them (the privacy policy names them in
  // prose, which is the point of the disclosure).
  const others = SHIPPED.filter(f => f !== 'legacy-cleanup.js' && !PROSE.has(f));
  for (const f of others) {
    const text = read(f);
    for (const key of ['ga_client_id', 'ga_debug', 'ga_session_id']) {
      assert.equal(text.includes(key), false, f + ' should not reference ' + key);
    }
  }
});

// ---------------------------------------------------------------------------
// Phase 5 — permissions
// ---------------------------------------------------------------------------

test('manifest requests only the two documented permissions', () => {
  assert.deepEqual(manifest.permissions.slice().sort(), ['storage', 'unlimitedStorage']);
});

test('manifest requests no credential-, tracking- or privilege-related permission', () => {
  const FORBIDDEN = [
    'cookies', 'webRequest', 'webRequestBlocking', 'declarativeNetRequestWithHostAccess',
    'history', 'identity', 'identity.email', 'debugger', 'management',
    'nativeMessaging', 'proxy', 'privacy', 'browsingData', 'topSites',
    'bookmarks', 'downloads', 'clipboardRead', 'geolocation', 'tabCapture',
    'desktopCapture', 'pageCapture', 'contentSettings', 'tabs', 'scripting',
    'activeTab', 'webNavigation', 'declarativeNetRequest'
  ];
  const requested = new Set([
    ...(manifest.permissions || []),
    ...(manifest.optional_permissions || [])
  ]);
  const bad = FORBIDDEN.filter(p => requested.has(p));
  assert.deepEqual(bad, [], 'forbidden permissions requested: ' + bad.join(', '));
});

test('host permissions are limited to instagram.com, with no wildcard scope', () => {
  assert.deepEqual(manifest.host_permissions.slice().sort(), [
    'https://instagram.com/*',
    'https://www.instagram.com/*'
  ]);
  for (const h of manifest.host_permissions) {
    assert.ok(!/<all_urls>|^\*:\/\/\*\/|^https?:\/\/\*\/\*/.test(h),
      'over-broad host permission: ' + h);
    assert.ok(h.startsWith('https://'), 'host permission must be https: ' + h);
  }
  assert.deepEqual(manifest.optional_host_permissions || [], []);
});

test('content scripts match only instagram.com', () => {
  for (const cs of manifest.content_scripts) {
    assert.deepEqual(cs.matches.slice().sort(), [
      'https://instagram.com/*',
      'https://www.instagram.com/*'
    ]);
  }
});

test('the MAIN-world script is the capture reader plus its allowlist, nothing else', () => {
  const main = manifest.content_scripts.filter(cs => cs.world === 'MAIN');
  assert.equal(main.length, 1, 'exactly one MAIN-world entry expected');
  assert.deepEqual(main[0].js, ['url-allowlist.js', 'capture-hook.js']);
});

test('manifest is V3 with no remote-code affordances', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, 'background.js');
  // MV2-only and remote-code keys must be absent.
  for (const key of ['background.page', 'background.scripts', 'content_security_policy_v2',
                     'externally_connectable', 'web_accessible_resources', 'sandbox']) {
    assert.equal(key in manifest, false, 'unexpected manifest key: ' + key);
  }
  assert.equal('scripts' in manifest.background, false);
  assert.equal('page' in manifest.background, false);
});

test('the extension name and description do not claim affiliation', () => {
  assert.equal(manifest.name, 'Saved Posts Library & Export');
  assert.equal(/instagram/i.test(manifest.name), false,
    'the word Instagram must not appear in the extension title');
  // The description may state factually where it works, but not imply endorsement.
  for (const claim of [/\bofficial\b/i, /\bapproved\b/i, /\bendorsed\b/i,
                       /\bpartner\b/i, /\bby Instagram\b/i, /\bby Meta\b/i, /\bbest\b/i]) {
    assert.equal(claim.test(manifest.description), false,
      'description must not match ' + claim + ': ' + manifest.description);
  }
  assert.ok(manifest.description.length <= 132,
    'CWS caps the manifest description at 132 chars');
});

// ---------------------------------------------------------------------------
// Credential access
// ---------------------------------------------------------------------------

test('no shipped code reads cookies, tokens, passwords or auth headers', () => {
  const patterns = [
    /document\.cookie/,
    /chrome\.cookies/,
    /\bcsrftoken\b/i,
    /\bsessionid\b/i,
    /['"]Authorization['"]/i,
    /\bx-csrftoken\b/i,
    /\bx-ig-app-id\b/i,
    /type\s*=\s*['"]password['"]/i,
    // Reading or assigning a password value. Deliberately NOT a bare
    // /\.password\b/: url-allowlist.js legitimately inspects URL.password in
    // order to *reject* credentialed URLs, which the next test asserts.
    /password\s*[:=]\s*['"]/i,
    /getElementById\(\s*['"][^'"]*password/i,
    /\bbearer\b/i,
    /localStorage\.getItem\(\s*['"](?!ga_)/   // any non-legacy localStorage read
  ];
  for (const p of patterns) {
    const hits = findAll(p);
    assert.deepEqual(hits, [], 'pattern ' + p + ' matches:\n' + hits.join('\n'));
  }
});

test('there is no login form or password field in any page', () => {
  for (const page of ['popup.html', 'gallery.html', 'privacy-policy.html']) {
    const html = flat(read(page));
    assert.equal(/<form\b/i.test(html), false, page + ' must contain no <form>');
    assert.equal(/type\s*=\s*["']password["']/i.test(html), false,
      page + ' must contain no password input');
    assert.equal(/autocomplete\s*=\s*["'][^"']*password/i.test(html), false,
      page + ' must not hint at a password field');
  }
});

// Two inputs exist by design: the gallery search box and the Import file
// picker. Anything else appearing here is a new data-entry surface that needs
// to be justified in the privacy disclosures.
test('the only inputs anywhere are the search box and the import file picker', () => {
  const expected = {
    'popup.html': [],
    'privacy-policy.html': [],
    'gallery.html': ['search-input', 'file-input']
  };
  for (const [page, ids] of Object.entries(expected)) {
    const html = flat(read(page));
    const inputs = html.match(/<input[^>]*>/gi) || [];
    const found = inputs.map(tag => {
      const m = tag.match(/id\s*=\s*["']([^"']+)["']/i);
      return m ? m[1] : tag;
    });
    assert.deepEqual(found.sort(), ids.slice().sort(),
      page + ' inputs changed — found: ' + JSON.stringify(found));
    for (const tag of inputs) {
      assert.equal(/type\s*=\s*["'](password|email|tel)["']/i.test(tag), false,
        'credential-shaped input in ' + page + ': ' + tag);
    }
  }
});

test('the privacy policy is inert static HTML', () => {
  const html = read('privacy-policy.html');
  assert.equal(/<script/i.test(html), false, 'the policy page must run no script');
  assert.equal(/\son[a-z]+\s*=/i.test(html), false, 'the policy page must have no inline handlers');
});

test('the URL allowlist rejects credentials embedded in a URL', () => {
  // The one place `password` appears in shipped code, and it appears in order
  // to refuse the URL. Asserted rather than merely excluded from the scan.
  const { loadIIFE } = require('./_setup');
  const { exposed } = loadIIFE('url-allowlist.js', {
    setup: (s) => { s.__SBE_TEST_HOOKS__ = {}; }
  });
  assert.equal(exposed.isAllowedMediaUrl('https://u:p@scontent.cdninstagram.com/x.jpg'), false);
  assert.equal(exposed.isAllowedMediaUrl('https://u@scontent.cdninstagram.com/x.jpg'), false);
  assert.equal(exposed.isAllowedMediaUrl('https://scontent.cdninstagram.com/x.jpg'), true);
});

// ---------------------------------------------------------------------------
// Remote code and dynamic evaluation
// ---------------------------------------------------------------------------

test('no shipped code loads or evaluates remote script', () => {
  for (const rel of SHIPPED.concat(VENDORED)) {
    const text = read(rel);
    // <script src="http..."> or a dynamically created remote script
    assert.equal(/<script[^>]+src=["']https?:/i.test(text), false,
      rel + ' must not load a remote <script>');
    assert.equal(/<link[^>]+href=["']https?:/i.test(text), false,
      rel + ' must not load a remote stylesheet');
    assert.equal(/@import\s+url\(\s*["']?https?:/i.test(text), false,
      rel + ' must not @import a remote stylesheet');
  }
  // eval / new Function only in our own code — JSZip is exempt from this scan
  // because it is a vendored minified bundle we do not author.
  for (const p of [/\beval\s*\(/, /new\s+Function\s*\(/, /setTimeout\s*\(\s*['"]/,
                   /import\s*\(/, /importScripts\s*\(/]) {
    const hits = findAll(p);
    assert.deepEqual(hits, [], 'dynamic evaluation ' + p + ' matches:\n' + hits.join('\n'));
  }
});

// ---------------------------------------------------------------------------
// Network destinations
// ---------------------------------------------------------------------------

// Every external host the shipped code may contact or link to. If a new host
// appears, this test fails and the outbound-domain table in
// COMPLIANCE_EVIDENCE.md has to be updated in the same change.
const DOCUMENTED_HOSTS = new Set([
  'www.instagram.com',       // host permission + post permalinks
  'instagram.com',           // host permission
  '*.cdninstagram.com',      // media CDN: CSP connect/img/media-src, allowlist
  '*.fbcdn.net',             // media CDN: CSP connect/img/media-src, allowlist
  'buymeacoffee.com',        // user-initiated donation link (popup)
  'www.patreon.com',         // user-initiated donation link (gallery)
  'developer.chrome.com',    // documentation link in the privacy policy
  'www.w3.org'               // SVG namespace URI, not a network fetch
]);

test('only documented external hosts appear in shipped source', () => {
  const found = new Map();
  for (const { file, text } of shippedSources()) {
    const urls = text.match(/https?:\/\/[a-zA-Z0-9._~:/?#@!$&*+,;=%-]+/g) || [];
    for (const u of urls) {
      let host;
      try { host = new URL(u).hostname; } catch (_) { continue; }
      // CSP directives are semicolon-delimited, so a URL scraped out of the
      // policy string can carry a trailing ';'. Strip CSP/prose punctuation
      // before comparing, or every CDN host reads as two different hosts.
      host = host.replace(/[;,)\]'"]+$/, '');
      if (!found.has(host)) found.set(host, file + ' -> ' + u);
    }
  }
  const undocumented = [...found.entries()].filter(([h]) => !DOCUMENTED_HOSTS.has(h));
  assert.deepEqual(undocumented.map(([h, where]) => h + ' (' + where + ')'), [],
    'undocumented external host(s) found — update DOCUMENTED_HOSTS and ' +
    'COMPLIANCE_EVIDENCE.md together');
});

test('the CDN hosts we fetch media from are exactly the allowlisted ones', () => {
  const allow = read('url-allowlist.js');
  assert.ok(allow.includes("'cdninstagram.com'"));
  assert.ok(allow.includes("'fbcdn.net'"));
  // Nothing else may be in the media-host list.
  const block = allow.slice(allow.indexOf('MEDIA_HOST_SUFFIXES = ['),
                            allow.indexOf('];', allow.indexOf('MEDIA_HOST_SUFFIXES = [')));
  const hosts = (block.match(/'([a-z0-9.-]+)'/g) || []).map(s => s.replace(/'/g, ''));
  assert.deepEqual(hosts.sort(), ['cdninstagram.com', 'fbcdn.net']);
});

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

test('no Instagram brand colour survives in the shipped UI', () => {
  const BRAND = /#(?:E1306C|833AB4|C13584|5851DB|405DE6|FD1D1D|F77737|FCAF45|FCB045|E4405F)\b/i;
  const BRAND_RGB = /rgba?\(\s*(?:225\s*,\s*48\s*,\s*108|131\s*,\s*58\s*,\s*180|193\s*,\s*53\s*,\s*132|88\s*,\s*81\s*,\s*219|64\s*,\s*93\s*,\s*230|253\s*,\s*29\s*,\s*29)/i;
  for (const rel of SHIPPED) {
    const text = read(rel);
    // tokens.css names the old values in a comment explaining the change.
    const scrubbed = rel === 'tokens.css'
      ? text.split('\n').filter(l => !l.trim().startsWith('(#') && !l.includes('used to be')).join('\n')
      : text;
    assert.equal(BRAND.test(scrubbed), false, rel + ' still contains an Instagram brand hex');
    assert.equal(BRAND_RGB.test(scrubbed), false, rel + ' still contains an Instagram brand rgb()');
  }
});

test('the required non-affiliation disclaimer appears in the popup, gallery and policy', () => {
  const REQUIRED = /Not affiliated with, authorized by, endorsed by, or sponsored by Instagram or Meta/i;
  for (const page of ['popup.html', 'gallery.html', 'privacy-policy.html']) {
    assert.ok(REQUIRED.test(flat(read(page))),
      page + ' must carry the non-affiliation disclaimer verbatim');
  }
});

test('user-facing download filenames are not Instagram-branded', () => {
  const gallery = read('gallery.js');
  const downloads = gallery.match(/\.download\s*=\s*[^;]+;/g) || [];
  assert.ok(downloads.length >= 4, 'expected several download filename assignments');
  for (const d of downloads) {
    assert.equal(/instagram/i.test(d), false, 'branded download filename: ' + d.trim());
  }
});

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

test('every HTML sink in shipped code is escaped, static, or internal', () => {
  // Rewritten during the 4.4.1 review: the previous version of this test only
  // examined the FIRST line of each assignment, so a multi-line statement whose
  // unescaped interpolation sat three lines further down was classified as a
  // "static literal" and passed. It was blind to exactly the case it existed to
  // catch. This version joins continuation lines and judges the whole statement.
  //
  // Also covers .outerHTML, not just .innerHTML.
  const FILES = ['popup.js', 'gallery.js', 'content.js', 'background.js',
                 'capture-hook.js', 'url-allowlist.js', 'legacy-cleanup.js'];

  // Values that reach a sink but are not attacker-controlled, each with the
  // reason. Intermediate *Html variables are resolved one level: they qualify
  // only if their own construction escapes.
  const SAFE = {
    iconId: 'internal literal from setBtnLabel callers',
    text: 'internal literal from setBtnLabel callers',
    currentTab: "fixed 'images'|'videos'",
    emptyIcon: 'internal literal',
    filtered: 'number',
    total: 'number',
    'slides.length': 'number',
    'item.carouselSize': 'number, validated on the way in',
    label: 'built with escapeHtml(searchQuery)',
    headHtml: 'built with escapeHtml(meta.owner)',
    captionHtml: 'built with escapeHtml(caption)'
    // thumbHtml is deliberately NOT here: it interpolates thumbnailUrl raw.
  };

  const offenders = [];
  for (const file of FILES) {
    const lines = read(file).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/\.(inner|outer)HTML\s*=/.test(lines[i])) continue;
      let stmt = lines[i].slice(lines[i].indexOf('=') + 1).trim();
      for (let j = i + 1; !stmt.trimEnd().endsWith(';') && j < lines.length && j - i < 25; j++) {
        stmt += ' ' + lines[j].trim();
      }
      const dynamic = [...stmt.matchAll(/\+\s*([A-Za-z_$][\w.$[\]]*)/g)]
        .map(m => m[1])
        .filter(v => v !== 'escapeHtml');       // a call, not a value
      const unresolved = dynamic.filter(v => !(v in SAFE));
      const stillRaw = unresolved.filter(v => !stmt.includes('escapeHtml(' + v));
      if (stillRaw.length) {
        offenders.push(`${file}:${i + 1}: unescaped ${[...new Set(stillRaw)].join(', ')}\n      ${stmt.slice(0, 180)}`);
      }
    }
  }

  assert.deepEqual(offenders, [],
    'Unescaped dynamic value(s) reaching an HTML sink:\n  ' + offenders.join('\n  ') +
    '\n\nSee COMPLIANCE_EVIDENCE.md section 15, open finding OF-1.');
});
