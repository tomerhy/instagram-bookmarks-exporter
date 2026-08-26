// Regression tests for the documents, not the code.
//
// WHY THIS FILE EXISTS: every previous round shipped documents that contradicted
// the code — "User activity: No" while the popup counted its own opens, "never
// touches the clipboard" while Copy writes to it, "no data leaves your device"
// while the gallery fetches thumbnails from a CDN, and a "Final package" section
// still describing a superseded release. Those are compliance defects as real as
// a bug, and prose drifts silently unless something asserts on it.
//
// Everything here is deliberately mechanical: exact phrases, storage-key
// inventories, and cross-document agreement. It cannot judge tone, and does not
// try to.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');

// Normalised view of a document, used for the claim scans below.
//
// Two things are stripped, both deliberately:
//   ~~struck text~~  a claim being RETRACTED. The corrections tables quote the
//                    old wording so a reviewer can see exactly what changed;
//                    marking it struck is what distinguishes "we no longer say
//                    this" from "we say this".
//   HTML tags        so `never <em>reads</em> your clipboard` matches the same
//                    phrase written without emphasis.
const flat = (f) => read(f)
  .replace(/~~[^~]*~~/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&mdash;|&ndash;/g, '-')
  .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
  .replace(/\s+/g, ' ');

const DOCS = ['privacy-policy.html', 'docs/CWS_PRIVACY_DISCLOSURES.md',
              'docs/CWS_STORE_LISTING.md', 'README.md', 'docs/COMPLIANCE_EVIDENCE.md',
              'docs/MANUAL_CHROME_TEST_PLAN.md'];
const UI = ['popup.html', 'gallery.html'];
const VERSION = JSON.parse(read('manifest.json')).version;

// ---------------------------------------------------------------------------
// Storage-key inventory: what the code actually writes
// ---------------------------------------------------------------------------

// Every key the shipped code writes to chrome.storage.local. Kept here so the
// inventory in the docs can be checked against something concrete.
const EXPECTED_KEYS = [
  'igExporterData',          // the captured library
  'igExporterLastSeenAt',    // powers the "new since last visit" badge
  'sbeConsentAcceptedAt',    // first-run disclosure acceptance
  'sbeLegacyCleanupAt',      // audit marker: legacy telemetry sweep
  'sbeLibrarySanitizedAt'    // audit marker: library sanitisation pass
];

// Keys removed in 4.4.3 that must not be written any more.
const REMOVED_KEYS = ['useCount', 'supportDismissed',
                      'igAutoplayEnabled', 'igAutoplayMuted'];

const CODE = ['background.js', 'content.js', 'popup.js', 'gallery.js',
              'capture-hook.js', 'url-allowlist.js', 'library-sanitize.js',
              'legacy-cleanup.js'];

// Strip // and /* */ comments. A comment explaining that a key was REMOVED
// legitimately names it, and must not read as a live reference.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
    .replace(/([;,)}'"`])[ \t]*\/\/.*$/gm, '$1');
}

// `igExporterData` holds a { images, videos } object. Those are fields of the
// stored value, not top-level storage keys, so they are not part of the
// inventory.
const NESTED_FIELDS = new Set(['images', 'videos']);

// Top-level keys of the object literal passed to chrome.storage.local.set().
// Brace-matched rather than regex-windowed: the naive version stopped at the
// first `}`, which is the nested { images, videos }, and silently missed every
// key declared after it.
function setCallKeys(src) {
  const keys = new Set();
  const NEEDLE = 'chrome.storage.local.set(';
  let i = 0;
  while ((i = src.indexOf(NEEDLE, i)) !== -1) {
    let j = src.indexOf('{', i + NEEDLE.length);
    const lineEnd = src.indexOf('\n', i + NEEDLE.length);
    if (j === -1 || (lineEnd !== -1 && j > lineEnd + 400)) { i += NEEDLE.length; continue; }
    let depth = 0, end = j;
    for (; end < src.length; end++) {
      if (src[end] === '{') depth++;
      else if (src[end] === '}') { depth--; if (depth === 0) break; }
    }
    const body = src.slice(j + 1, end);
    // Only depth-1 keys: strip nested object literals first.
    const topLevel = body.replace(/\{[^{}]*\}/g, '""');
    for (const k of topLevel.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) {
      if (!NESTED_FIELDS.has(k[1])) keys.add(k[1]);
    }
    i = end;
  }
  return keys;
}

function storageWrites() {
  const found = new Set();
  for (const f of CODE) {
    const src = stripComments(read(f));
    for (const k of setCallKeys(src)) found.add(k);
    // Keys written via a computed property, e.g. stamp[MARKER_KEY] = ...
    for (const name of EXPECTED_KEYS.concat(REMOVED_KEYS)) {
      if (new RegExp("['\"]" + name + "['\"]").test(src)) found.add(name);
    }
  }
  return found;
}

test('the code writes no storage key outside the documented inventory', () => {
  const written = storageWrites();
  const unexpected = [...written].filter(
    k => !EXPECTED_KEYS.includes(k) && !REMOVED_KEYS.includes(k));
  assert.deepEqual(unexpected, [],
    'undocumented storage key(s): ' + unexpected.join(', ') +
    '\nAdd them to EXPECTED_KEYS here AND to the inventory in ' +
    'privacy-policy.html and docs/COMPLIANCE_EVIDENCE.md.');
});

test('the removed 4.4.3 keys are only referenced by legacy-cleanup.js', () => {
  for (const f of CODE.filter(x => x !== 'legacy-cleanup.js')) {
    const src = stripComments(read(f));
    for (const k of REMOVED_KEYS) {
      assert.equal(src.includes(k), false,
        f + ' still references the removed key ' + k);
    }
  }
  const cleanup = read('legacy-cleanup.js');
  for (const k of REMOVED_KEYS) {
    assert.ok(cleanup.includes(k), 'legacy-cleanup.js must delete ' + k);
  }
});

test('no popup-use counter or threshold donation banner remains', () => {
  for (const f of CODE.concat(UI)) {
    if (f === 'legacy-cleanup.js') continue;
    const src = stripComments(read(f));
    for (const bad of ['useCount', 'USE_THRESHOLD', 'incrementUseCount',
                       'checkSupportBanner', 'supportDismissed']) {
      assert.equal(src.includes(bad), false, f + ' still contains ' + bad);
    }
  }
  assert.equal(read('popup.html').includes('support-banner'), false,
    'the threshold-triggered banner markup must be gone');
});

test('every documented storage key is actually written by the code', () => {
  const written = storageWrites();
  for (const k of EXPECTED_KEYS) {
    assert.ok(written.has(k), 'documented key never written: ' + k);
  }
});

test('the privacy policy inventories sbeLibrarySanitizedAt', () => {
  assert.match(flat('privacy-policy.html'), /sbeLibrarySanitizedAt/,
    'the 4.4.2 sanitisation marker must appear in the storage inventory');
});

test('the privacy policy does not inventory a "sort order" it never persists', () => {
  // It was listed as a stored preference; nothing writes it.
  const written = storageWrites();
  assert.equal([...written].some(k => /sort/i.test(k)), false,
    'if a sort preference is now persisted, add it to EXPECTED_KEYS');
  assert.equal(/sort order/i.test(flat('privacy-policy.html')), false,
    'privacy-policy.html lists a stored "sort order" that does not exist');
});

// ---------------------------------------------------------------------------
// User activity must not be denied
// ---------------------------------------------------------------------------

test('CWS_PRIVACY_DISCLOSURES does not claim User activity: No', () => {
  const d = flat('docs/CWS_PRIVACY_DISCLOSURES.md');
  assert.equal(/User activity\s*\|\s*\*\*No\*\*/.test(d), false,
    'consent and last-seen timestamps are local interaction state; ' +
    'answering No is indefensible');
  assert.match(d, /User activity\s*\|\s*\*\*Yes\*\*/,
    'User activity must be answered Yes, with the narrow local-only explanation');
});

test('no document claims that no clicks or user activity are collected', () => {
  for (const f of DOCS) {
    const t = flat(f);
    for (const claim of [/No clicks or user activity are collected/i,
                         /no user activity is collected/i,
                         /No clicks, mouse position, keystroke/i]) {
      assert.equal(claim.test(t), false, f + ' still asserts: ' + claim);
    }
  }
});

// ---------------------------------------------------------------------------
// Clipboard, downloads, and CDN claims
// ---------------------------------------------------------------------------

test('no document claims the extension never touches the clipboard', () => {
  // Copy URLs writes to the clipboard. The accurate claim is read-vs-write.
  for (const f of DOCS.concat(UI)) {
    const t = flat(f);
    assert.equal(/never touches[^.]*clipboard/i.test(t), false,
      f + ': it writes to the clipboard on Copy');
    assert.equal(/does not (use|touch|access) the clipboard/i.test(t), false,
      f + ': inaccurate blanket clipboard claim');
  }
  assert.match(flat('privacy-policy.html'), /never reads? (your |the )?clipboard/i,
    'the policy must state the read-vs-write distinction');
});

test('the policy states the accurate downloads position', () => {
  const t = flat('privacy-policy.html');
  assert.equal(/never touches[^.]*downloads/i.test(t), false,
    'the extension does create user-requested downloads');
  assert.match(t, /downloads?[^.]{0,120}permission/i,
    'the policy must say the downloads permission is not requested');
});

test('no document claims data never leaves the device as an absolute', () => {
  for (const f of DOCS.concat(UI)) {
    const t = flat(f);
    for (const claim of [/No data (ever )?leaves your device/i,
                         /nothing (ever )?leaves your device/i,
                         /no data is ever sent to external servers/i]) {
      assert.equal(claim.test(t), false,
        f + ' asserts an absolute that CDN media requests contradict');
    }
  }
});

test('no document says CDN requests happen only on Download', () => {
  // Opening the library renders thumbnails, which fetches from the CDN.
  for (const f of DOCS) {
    const t = flat(f);
    for (const claim of [/only when you press Download/i,
                         /only when the user presses Download/i,
                         /only on an explicit download/i]) {
      assert.equal(claim.test(t), false,
        f + ': thumbnails load on library open, before any download');
    }
  }
});

test('policy, listing and manual plan all disclose thumbnail-time CDN loads', () => {
  for (const f of ['privacy-policy.html', 'docs/CWS_STORE_LISTING.md',
                   'docs/MANUAL_CHROME_TEST_PLAN.md', 'docs/CWS_PRIVACY_DISCLOSURES.md']) {
    const t = flat(f);
    assert.ok(/thumbnail/i.test(t) && /(CDN|cdninstagram)/i.test(t),
      f + ' must disclose that thumbnails/previews load from the CDN');
  }
});

test('the accurate non-transmission sentence appears in policy and disclosures', () => {
  const REQUIRED = /does not transmit the captured library to the developer/i;
  for (const f of ['privacy-policy.html', 'docs/CWS_PRIVACY_DISCLOSURES.md']) {
    assert.ok(REQUIRED.test(flat(f)),
      f + ' must carry the scoped non-transmission statement');
  }
});

// ---------------------------------------------------------------------------
// Version and product-name agreement
// ---------------------------------------------------------------------------

test('the product name is consistent across manifest, UI and docs', () => {
  const NAME = 'Saved Posts Library & Export';
  assert.equal(JSON.parse(read('manifest.json')).name, NAME);
  for (const f of ['popup.html', 'gallery.html', 'privacy-policy.html']) {
    assert.ok(flat(f).includes('Saved Posts Library'),
      f + ' must use the current product name');
  }
  for (const stale of ['Saved Posts Backup', 'IG Exporter',
                       'Instagram Saved Media Exporter']) {
    for (const f of UI.concat(['index.html'])) {
      assert.equal(read(f).includes(stale), false,
        f + ' still contains the superseded name: ' + stale);
    }
  }
});

test('COMPLIANCE_EVIDENCE final-package section describes the current version', () => {
  // 4.4.2 left a "Final package" section describing 4.4.1 — wrong filename,
  // wrong hash, wrong test count, and a stale open-finding caveat. A reviewer
  // must not have to read an appendix to discover the headline is obsolete.
  const t = read('docs/COMPLIANCE_EVIDENCE.md');
  const idx = t.indexOf('## 2. Final package');
  assert.ok(idx > 0, 'the Final package section must exist');
  // Bound the section at the next heading, not at a fixed character count —
  // a fixed window bleeds into the following section and reads its content.
  const after = t.indexOf('\n## ', idx + 1);
  const section = after === -1 ? t.slice(idx) : t.slice(idx, after);
  assert.ok(section.includes('saved-posts-library-export-' + VERSION + '.zip'),
    'the Final package section must name the current artifact, not a superseded one');
  assert.equal(/saved-posts-backup-export-4\.4\.1\.zip/.test(section), false,
    'the superseded 4.4.1 filename must not appear as the final package');
  assert.equal(/1ade0a8db533d5a38e578ed7ac32627805d4d887879c812e7aec52feca51ab1e/.test(section), false,
    'the superseded 4.4.1 hash must not be presented as final');
});

test('COMPLIANCE_EVIDENCE reports the real test count', () => {
  // Derived, not hardcoded: count the test declarations on disk and require the
  // evidence document to state that number. A stale count is how a reviewer
  // loses confidence in every other number in the document.
  const dir = path.join(REPO_ROOT, 'tests');
  let declared = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.js')) continue;
    declared += (fs.readFileSync(path.join(dir, f), 'utf8')
      .match(/^test\(/gm) || []).length;
  }
  // Some suites generate tests in a loop, so the runtime total is >= declared.
  // The document must name a number at least as large as the static count.
  const t = read('docs/COMPLIANCE_EVIDENCE.md');
  const numbers = (t.match(/\b(\d{3,4}) (?:tests|passing)\b/g) || [])
    .map(m => parseInt(m, 10));
  assert.ok(numbers.length > 0, 'no test total stated in the evidence document');
  const best = Math.max(...numbers);
  assert.ok(best >= declared,
    'evidence states ' + best + ' tests but ' + declared +
    ' are declared on disk — the count is stale');
});

test('v4.3.10 is still labelled as tagged source, never as the uploaded ZIP', () => {
  const t = flat('docs/COMPLIANCE_EVIDENCE.md');
  assert.match(t, /not a byte-verified copy of the (package|ZIP) uploaded/i,
    'the v4.3.10 limitation label must remain');
  assert.equal(/the published 4\.3\.10 (ZIP|package) was (audited|inspected|verified)/i.test(t), false,
    'must never claim the uploaded 4.3.10 artifact was inspected');
});

// ---------------------------------------------------------------------------
// Landing page claims
// ---------------------------------------------------------------------------

const LANDING_PROHIBITED = [
  'Saved Posts Backup',
  'Back Up Your Saved Posts',
  'download all',
  'Never lose your favorite content again',
  'Automatically captures all slides',
  'No content left behind',
  'No more',
  'Coming soon',
  'Add to Chrome',
  'Get It Free',
  'hundreds of posts',
  'less than 5 seconds',
  'formspree',
  'testimonial'
];

test('index.html carries none of the prohibited claims', () => {
  const t = read('index.html');
  const found = LANDING_PROHIBITED.filter(
    p => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(t));
  assert.deepEqual(found, [],
    'index.html still contains prohibited claim(s): ' + found.join(' | '));
});

test('index.html references no disqualified screenshot', () => {
  const t = read('index.html');
  assert.equal(/assets\/screenshots\//.test(t), false,
    'the old screenshots contain real third-party Instagram data and must not ' +
    'be referenced; use a neutral placeholder until synthetic ones exist');
});

test('index.html states the capture-vs-download distinction', () => {
  const t = flat('index.html');
  assert.ok(/links and (post )?details/i.test(t),
    'must say capture stores links and details');
  assert.ok(/expire/i.test(t), 'must say captured links can expire');
  assert.ok(/download/i.test(t), 'must explain that downloads produce files');
});

test('index.html keeps the non-affiliation disclaimer', () => {
  assert.match(flat('index.html'),
    /Not affiliated with, authorized by, endorsed by, or sponsored by Instagram or Meta/);
});

test('index.html uses a truthful source link, not a store CTA', () => {
  const t = read('index.html');
  assert.ok(/View source on GitHub/i.test(t),
    'until the item is reinstated the CTA must point at the source');
  assert.equal(/chrome\.google\.com\/webstore|chromewebstore\.google\.com/.test(t), false,
    'no store link while the item is not listed');
});
