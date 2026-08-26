// Phase 5 evidence: an enumeration test over every URL sink in gallery.js.
//
// The point of this file is completeness, not cleverness. The 4.4.1 review
// found that fixing one innerHTML statement was not enough — the same class of
// bug existed at img.src, video.src, imageViewer.src, the fullscreen sinks,
// window.open, fetch, the clipboard and the exports. So instead of testing
// known sinks one by one, this walks the source, finds EVERY assignment to a
// URL-bearing property and every navigation/fetch call, and requires each one
// to be either allowlist-validated on the same line or explicitly documented
// below as static/internal.
//
// A new sink added without a guard fails this test by default. That is the
// property worth having: the test does not need updating to catch the next one.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadGallery } = require('./_setup');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_FILES = ['gallery.js', 'popup.js', 'content.js', 'background.js',
                      'capture-hook.js', 'legacy-cleanup.js'];

// Anything on this list is a sink whose value is provably static or internal.
// Each entry names the file, the matched text, and WHY it needs no allowlist
// check. Adding to this list is the documented escape hatch; it should be rare
// and each line should be defensible on its own.
const DOCUMENTED_STATIC_SINKS = [
  {
    match: 'this.src = "data:image/svg+xml,',
    why: 'static inline SVG placeholder for a broken thumbnail. A literal, ' +
         'no interpolation. Permitted by the CSP via img-src data:.'
  },
  {
    match: 'window.open("https://www.patreon.com/join/THYProduction", "_blank", "noopener,noreferrer")',
    why: 'hard-coded donation URL, opened only on an explicit click. No ' +
         'stored or user value is involved.'
  },
  {
    match: 'chrome.tabs.create({ url: COFFEE_URL })',
    why: 'hard-coded donation URL constant in popup.js, click-only.'
  },
  {
    match: "chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') })",
    why: 'extension-internal page URL produced by chrome.runtime.getURL.'
  },
  {
    match: 'a.href = URL.createObjectURL(',
    why: 'blob: URL for a locally generated file (JSON / CSV / ZIP). Created ' +
         'in-process from bytes we assembled; never a stored value.'
  },
  {
    match: 'a.href = blobUrl',
    why: 'same blob: URL as above, held in a local variable.'
  },
  {
    match: 'player.src = ""',
    why: 'clearing the player before loading a new source; the empty string is not a URL.'
  },
  {
    match: 'imageViewer.src = ""',
    why: 'clearing the image viewer; the empty string is not a URL.'
  },
  {
    match: "fullscreenVideo.src = ''",
    why: 'clearing the fullscreen video element; the empty string is not a URL.'
  }
];

// Property assignments that put a URL into the DOM, plus navigation and fetch.
const SINK_PATTERNS = [
  { label: '.src assignment',      re: /\.src\s*=\s*(.+)$/ },
  { label: '.href assignment',     re: /\.href\s*=\s*(.+)$/ },
  { label: '.poster assignment',   re: /\.poster\s*=\s*(.+)$/ },
  { label: 'window.open',          re: /window\.open\s*\((.+)$/ },
  { label: 'fetch',                re: /(?:^|[^.\w])fetch\s*\((.+)$/ },
  { label: 'clipboard write',      re: /clipboard\.writeText\s*\((.+)$/ },
  { label: 'setAttribute src/href',re: /setAttribute\(\s*["'](?:src|href|poster)["']\s*,(.+)$/ }
];

// A sink is considered guarded when the guard appears on the same statement.
const GUARDS = ['safeMediaUrl', 'safePostUrl', 'safeExternalNavigationUrl',
                'safeExportUrl', 'isAllowedMediaUrl', 'isAllowedPostUrl'];

function readSource(file) {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
}

function isComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

function collectSinks() {
  const sinks = [];
  for (const file of SOURCE_FILES) {
    const lines = readSource(file).split('\n');
    lines.forEach((line, i) => {
      if (isComment(line)) return;
      for (const { label, re } of SINK_PATTERNS) {
        const m = line.match(re);
        if (!m) continue;
        sinks.push({ file, line: i + 1, label, text: line.trim() });
      }
    });
  }
  return sinks;
}

test('every URL sink is allowlist-guarded or documented as static', () => {
  const sinks = collectSinks();
  assert.ok(sinks.length >= 15,
    'expected the enumeration to find the known sinks; found ' + sinks.length +
    ' — if this dropped, the patterns above have stopped matching');

  const unguarded = [];
  for (const s of sinks) {
    const guarded = GUARDS.some(g => s.text.includes(g));
    const documented = DOCUMENTED_STATIC_SINKS.some(d => s.text.includes(d.match));
    if (!guarded && !documented) {
      unguarded.push(`${s.file}:${s.line} [${s.label}] ${s.text.slice(0, 150)}`);
    }
  }

  assert.deepEqual(unguarded, [],
    'URL sink(s) with neither an allowlist guard nor a documented static ' +
    'source:\n  ' + unguarded.join('\n  ') +
    '\n\nEither wrap the value in safeMediaUrl / safePostUrl / ' +
    'safeExternalNavigationUrl, or add it to DOCUMENTED_STATIC_SINKS with a ' +
    'reason.');
});

test('the documented-static list has no stale entries', () => {
  // A documented exemption that no longer matches anything is a stale licence
  // to skip a guard. Remove it rather than leaving it lying around.
  const all = SOURCE_FILES.map(readSource).join('\n');
  const stale = DOCUMENTED_STATIC_SINKS
    .filter(d => !all.includes(d.match))
    .map(d => d.match);
  assert.deepEqual(stale, [], 'stale exemption(s): ' + stale.join(' | '));
});

test('every documented exemption states a reason', () => {
  for (const d of DOCUMENTED_STATIC_SINKS) {
    assert.ok(d.why && d.why.length > 20,
      'exemption needs a real justification: ' + d.match);
  }
});

test('the guard helpers exist and fail closed', () => {
  const g = loadGallery();
  for (const name of ['safeMediaUrl', 'safePostUrl', 'safeExternalNavigationUrl', 'safeExportUrl']) {
    assert.equal(typeof g[name], 'function', name + ' must exist');
    // Every falsy / wrong-typed input yields null, never the input.
    for (const bad of [null, undefined, '', 0, 42, {}, [], true]) {
      assert.equal(g[name](bad), null, name + ' must reject ' + JSON.stringify(bad));
    }
  }
});

test('safeMediaUrl accepts CDN media and rejects everything else', () => {
  const g = loadGallery();
  assert.equal(g.safeMediaUrl('https://scontent.cdninstagram.com/v/t51/a.jpg'),
    'https://scontent.cdninstagram.com/v/t51/a.jpg');
  assert.equal(g.safeMediaUrl('https://video.xx.fbcdn.net/v/t66/a.mp4'),
    'https://video.xx.fbcdn.net/v/t66/a.mp4');
  // A permalink is NOT media — this is the type confusion 4.4.1 had.
  assert.equal(g.safeMediaUrl('https://www.instagram.com/p/ABC/'), null);
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'blob:https://x/y',
                     'file:///etc/passwd', 'chrome-extension://a/b',
                     'https://evilcdninstagram.com/x.jpg',
                     'https://cdninstagram.com.evil.example/x.jpg',
                     'https://user:pass@scontent.cdninstagram.com/x.jpg',
                     'http://scontent.cdninstagram.com/x.jpg']) {
    assert.equal(g.safeMediaUrl(bad), null, 'must reject ' + bad);
  }
});

test('safePostUrl accepts permalinks and rejects media and everything else', () => {
  const g = loadGallery();
  assert.equal(g.safePostUrl('https://www.instagram.com/p/ABC/'),
    'https://www.instagram.com/p/ABC/');
  assert.equal(g.safePostUrl('https://instagram.com/p/ABC/'),
    'https://instagram.com/p/ABC/');
  assert.equal(g.safePostUrl('https://scontent.cdninstagram.com/a.jpg'), null,
    'a CDN asset is not a post permalink');
  assert.equal(g.safePostUrl('https://instagram.com.evil.example/p/ABC/'), null);
  assert.equal(g.safePostUrl('javascript:alert(1)'), null);
});

test('safeExternalNavigationUrl only ever yields a permalink', () => {
  const g = loadGallery();
  // Phase 3 requirement 4: a raw media URL must never be offered as the
  // "Open original post" link.
  assert.equal(g.safeExternalNavigationUrl('https://scontent.cdninstagram.com/a.jpg'), null);
  assert.equal(g.safeExternalNavigationUrl('https://www.instagram.com/p/ABC/'),
    'https://www.instagram.com/p/ABC/');
});

test('the accessors never return an unvalidated value', () => {
  const g = loadGallery();
  const hostile = {
    type: 'image',
    url: 'javascript:alert(1)',
    thumbnail: 'data:text/html,alert(1)',
    postUrl: 'https://evil.example/p/x/'
  };
  assert.equal(g.getUrl(hostile), null);
  assert.equal(g.getThumbnail(hostile), null);
  assert.equal(g.getPostUrl(hostile), null);
  assert.equal(g.getMediaUrl(hostile), null);

  // A string item is still run through the media allowlist.
  assert.equal(g.getUrl('javascript:alert(1)'), null);
  assert.equal(g.getUrl('https://scontent.cdninstagram.com/a.jpg'),
    'https://scontent.cdninstagram.com/a.jpg');
});

test('getMediaUrl never returns a permalink, getUrl may fall back to one', () => {
  const g = loadGallery();
  const postOnly = { type: 'video', url: null, thumbnail: null,
                     postUrl: 'https://www.instagram.com/p/ABC/' };
  assert.equal(g.getMediaUrl(postOnly), null,
    'nothing here may reach player.src');
  assert.equal(g.getUrl(postOnly), 'https://www.instagram.com/p/ABC/',
    'but the record is still openable, which is why the post-only case exists');
});

test('isPlayableVideoUrl allowlists before pattern-matching', () => {
  const g = loadGallery();
  // The old implementation used a substring check on "cdninstagram", which
  // evilcdninstagram.com satisfies. Allowlist must come first.
  assert.equal(g.isPlayableVideoUrl('https://evilcdninstagram.com/video.mp4'), false);
  assert.equal(g.isPlayableVideoUrl('https://cdninstagram.com.evil.example/v/x.mp4'), false);
  assert.equal(g.isPlayableVideoUrl('https://video.xx.fbcdn.net/v/t66/a.mp4'), true);
  assert.equal(g.isPlayableVideoUrl('javascript:alert(1)'), false);
});

test('export paths strip URLs that would not render', () => {
  const g = loadGallery();
  const rows = g._exportSafeList([
    { type: 'image', url: 'javascript:alert(1)' },
    { type: 'image', url: 'https://scontent.cdninstagram.com/ok.jpg',
      postUrl: 'javascript:alert(1)' },
    { type: 'video', url: 'https://evil.example/x.mp4' }
  ]);
  assert.equal(rows.length, 1, 'only the record with a valid URL is exported');
  assert.equal(rows[0].url, 'https://scontent.cdninstagram.com/ok.jpg');
  assert.equal(rows[0].postUrl, null, 'the hostile permalink is stripped');
});

test('CSV output contains no hostile URL', () => {
  const g = loadGallery();
  const csv = g.buildCsv([
    { type: 'image', url: 'javascript:alert(1)', metadata: { caption: 'x' } },
    { type: 'image', url: 'https://scontent.cdninstagram.com/ok.jpg' }
  ]);
  assert.equal(csv.includes('javascript:'), false, 'CSV must not carry a javascript: URL');
  assert.ok(csv.includes('https://scontent.cdninstagram.com/ok.jpg'));
});

test('JSON export contains no hostile URL', () => {
  const g = loadGallery();
  const payload = g.buildExportPayload(
    [{ type: 'image', url: 'data:text/html,alert(1)' },
     { type: 'image', url: 'https://scontent.cdninstagram.com/ok.jpg' }],
    [{ type: 'video', url: 'https://evilcdninstagram.com/x.mp4' }],
    '4.4.2');
  const json = JSON.stringify(payload);
  for (const bad of ['data:text/html', 'evilcdninstagram']) {
    assert.equal(json.includes(bad), false, 'export must not carry ' + bad);
  }
  assert.equal(payload.images.length, 1);
  assert.equal(payload.videos.length, 0);
});

test('showVideoFallback builds DOM nodes and never concatenates a URL into HTML', () => {
  // Source-level assertion: the function must not contain string-built markup.
  const src = readSource('gallery.js');
  const start = src.indexOf('function showVideoFallback(');
  assert.ok(start > 0, 'showVideoFallback must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.equal(/innerHTML/.test(body), false,
    'showVideoFallback must not use innerHTML');
  assert.equal(/outerHTML/.test(body), false);
  assert.equal(/['"]<\s*(img|a|div|p)\b/i.test(body), false,
    'no HTML tag may be built as a string here');
  assert.ok(/createElement/.test(body), 'must construct nodes');
  assert.ok(/textContent/.test(body), 'must set text via textContent');
  assert.ok(/replaceChildren/.test(body), 'must swap children wholesale');
  assert.ok(/safeMediaUrl/.test(body) && /safeExternalNavigationUrl/.test(body),
    'both URLs must be validated at this sink');
});
