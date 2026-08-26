// Phase 4 evidence: the extension-page Content Security Policy is present,
// restrictive, and names no destination beyond the documented Instagram/Meta
// CDN hosts.
//
// SCOPE LIMIT, stated up front: these are STATIC checks. They parse the policy
// out of manifest.json and assert on its directives. They do NOT load the
// extension into Chrome, so they cannot prove Chrome accepts the policy, nor
// that CDN thumbnails and ZIP downloads still work under it. Those two are
// manual blockers — docs/MANUAL_CHROME_TEST_PLAN.md sections 7 and 8.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'manifest.json'), 'utf8'));

// The only external destinations the CSP may name.
const ALLOWED_HOSTS = ['https://*.cdninstagram.com', 'https://*.fbcdn.net'];

function policy() {
  assert.ok(manifest.content_security_policy,
    'manifest must declare content_security_policy');
  const p = manifest.content_security_policy.extension_pages;
  assert.ok(typeof p === 'string' && p.length,
    'content_security_policy.extension_pages must be a non-empty string');
  return p;
}

// Parse "name a b; name2 c" into { name: [a, b], name2: [c] }.
function directives() {
  const out = {};
  for (const part of policy().split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    out[tokens[0]] = tokens.slice(1);
  }
  return out;
}

test('CSP: extension_pages policy is declared', () => {
  assert.ok(policy().length > 0);
});

test('CSP: script-src is exactly self', () => {
  const d = directives();
  assert.deepEqual(d['script-src'], ["'self'"],
    "script-src must be exactly 'self' — no host, no scheme, no keyword");
});

test('CSP: no unsafe-inline, unsafe-eval or wasm-unsafe-eval for scripts', () => {
  const p = policy();
  for (const bad of ["'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", "'unsafe-hashes'"]) {
    assert.equal(p.includes(bad), false, 'CSP must not contain ' + bad);
  }
});

test('CSP: object-src, frame-src, base-uri and form-action are locked down', () => {
  const d = directives();
  assert.deepEqual(d['object-src'], ["'none'"]);
  assert.deepEqual(d['frame-src'], ["'none'"]);
  assert.deepEqual(d['base-uri'], ["'none'"],
    "base-uri 'none' stops a <base> tag rewriting every relative URL");
  assert.deepEqual(d['form-action'], ["'none'"],
    "form-action 'none' means no form in any extension page can submit anywhere");
});

test('CSP: connect-src permits only self plus the documented CDN hosts', () => {
  const d = directives();
  assert.ok(d['connect-src'], 'connect-src must be declared');
  assert.deepEqual(d['connect-src'].slice().sort(),
    ["'self'"].concat(ALLOWED_HOSTS).sort(),
    'connect-src is what bounds fetch(); it must name nothing else');
});

test('CSP: img-src permits only self, data: and the documented CDN hosts', () => {
  const d = directives();
  assert.ok(d['img-src'], 'img-src must be declared');
  assert.deepEqual(d['img-src'].slice().sort(),
    ["'self'", 'data:'].concat(ALLOWED_HOSTS).sort(),
    'data: is required by the static broken-thumbnail placeholder in gallery.js');
});

test('CSP: media-src permits only self, blob: and the documented CDN hosts', () => {
  const d = directives();
  assert.ok(d['media-src'], 'media-src must be declared');
  assert.deepEqual(d['media-src'].slice().sort(),
    ["'self'", 'blob:'].concat(ALLOWED_HOSTS).sort(),
    'blob: is required so a fetched video blob can be played back locally');
});

test('CSP: names no host beyond the two documented CDN wildcards', () => {
  const hosts = policy().match(/https?:\/\/[^\s;]+/g) || [];
  const unexpected = hosts.filter(h => !ALLOWED_HOSTS.includes(h));
  assert.deepEqual(unexpected, [],
    'unexpected host(s) in the CSP: ' + unexpected.join(', '));
});

test('CSP: contains no broad wildcard', () => {
  // Token-wise, not substring-wise: 'https://*' as a SUBSTRING legitimately
  // occurs inside 'https://*.cdninstagram.com'. What must never appear is a
  // whole source token that matches every host.
  const BAD_SOURCES = ['*', 'https://*', 'http://*', 'https:', 'http:', 'data:*', '<all_urls>'];
  const d = directives();
  for (const [name, sources] of Object.entries(d)) {
    for (const src of sources) {
      assert.equal(BAD_SOURCES.includes(src), false,
        'over-broad source "' + src + '" in ' + name);
      // A wildcard is only acceptable as a leading subdomain wildcard on a
      // specific registrable domain: https://*.example.com
      if (src.includes('*')) {
        assert.match(src, /^https:\/\/\*\.[a-z0-9-]+(\.[a-z0-9-]+)+$/,
          'wildcard source must be https://*.<domain>, got: ' + src);
      }
    }
  }
  // The only asterisks permitted are the subdomain wildcards of the two CDNs,
  // appearing once each in connect-src, img-src and media-src.
  const stars = (policy().match(/\*/g) || []).length;
  assert.equal(stars, 6,
    'expected exactly 6 asterisks (2 CDN wildcards x connect/img/media-src), got ' + stars);
});

test('CSP: does not use http: anywhere', () => {
  assert.equal(/http:\/\//.test(policy()), false,
    'every CSP source must be https or a keyword');
});

test('CSP: no sandbox key and no MV2-style policy string', () => {
  assert.equal('sandbox' in manifest, false);
  assert.equal(typeof manifest.content_security_policy, 'object',
    'MV3 requires the object form, not the MV2 string');
  // Only extension_pages is set; sandbox pages are not used at all.
  assert.deepEqual(Object.keys(manifest.content_security_policy), ['extension_pages']);
});

test('CSP: every host it names is also on the runtime URL allowlist', () => {
  // The two must not drift: a host the CSP permits but the allowlist rejects
  // would be dead configuration, and the reverse would be a hole.
  const allowlist = fs.readFileSync(path.join(REPO_ROOT, 'url-allowlist.js'), 'utf8');
  for (const h of ALLOWED_HOSTS) {
    const bare = h.replace('https://*.', '');
    assert.ok(allowlist.includes("'" + bare + "'"),
      bare + ' is in the CSP but not in MEDIA_HOST_SUFFIXES');
  }
});

test('CSP: the documented CDN hosts are exactly the allowlist media hosts', () => {
  const allowlist = fs.readFileSync(path.join(REPO_ROOT, 'url-allowlist.js'), 'utf8');
  const block = allowlist.slice(
    allowlist.indexOf('MEDIA_HOST_SUFFIXES = ['),
    allowlist.indexOf('];', allowlist.indexOf('MEDIA_HOST_SUFFIXES = [')));
  const hosts = (block.match(/'([a-z0-9.-]+)'/g) || []).map(s => s.replace(/'/g, ''));
  assert.deepEqual(hosts.sort(), ['cdninstagram.com', 'fbcdn.net']);
  assert.deepEqual(ALLOWED_HOSTS.map(h => h.replace('https://*.', '')).sort(),
    hosts.sort(), 'the CSP host list and the allowlist must stay in lockstep');
});

test('CSP: build output carries the policy', () => {
  // Guards against the manifest being rewritten by the build. build.sh copies
  // manifest.json verbatim, so this is a cheap regression check on that.
  const built = path.join(REPO_ROOT, 'dist', 'manifest.json');
  if (!fs.existsSync(built)) return;   // no build in this working tree yet
  const m = JSON.parse(fs.readFileSync(built, 'utf8'));
  assert.deepEqual(m.content_security_policy, manifest.content_security_policy,
    'the packaged manifest must carry the same CSP as the source manifest');
});
