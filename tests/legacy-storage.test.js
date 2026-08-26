// Phase 2 + Phase 5 evidence: hostile records ALREADY PRESENT in
// chrome.storage.local cannot reach any sink.
//
// This is the gap the independent review found in 4.4.1. Import was validated;
// records written by 4.4.0 or earlier were not, and they were loaded straight
// into the gallery. So these tests seed hostile records into the *storage stub*
// — not into an import file — and then assert on what the gallery does with
// them.
//
// The payload list is deliberately the one from the review, plus records
// carrying extra properties (innerHTML / outerHTML / onclick / srcdoc) to prove
// field-by-field rebuilding drops them.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGallery, loadContent } = require('./_setup');

// Values created inside the vm context have that realm's prototypes, so
// assert.deepEqual on them fails with "same structure but not reference-equal".
// Round-tripping through JSON gives host-realm plain objects to compare.
const plain = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));

const GOOD_IMG = 'https://scontent.cdninstagram.com/v/t51/legit_n.jpg';
const GOOD_VID = 'https://video-lhr8.xx.fbcdn.net/v/t66/legit.mp4';
const GOOD_POST = 'https://www.instagram.com/p/Cabc123_/';

// Every one of these must be rejected wherever it appears.
const HOSTILE_URLS = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'data:text/html,alert(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'data:image/svg+xml,<svg onload=alert(1)>',
  'blob:https://www.instagram.com/8a7f-4c3e',
  'file:///etc/passwd',
  'chrome-extension://abcdefghijklmnop/gallery.html',
  'chrome://settings',
  'about:blank',
  'http://scontent.cdninstagram.com/v/x.jpg',
  'https://evilcdninstagram.com/video.mp4',
  'https://cdninstagram.com.evil.example/image.jpg',
  'https://fbcdn.net.evil.example/x.jpg',
  'https://user:pass@scontent.cdninstagram.com/file.jpg',
  'https://localhost:8080/x.jpg',
  'https://127.0.0.1/x.jpg',
  'https://[::1]/x.jpg',
  'https://evil.example/x.jpg',
  '//scontent.cdninstagram.com/x.jpg',
  'https://scontent.cdninstagram.com/x.jpg" onerror="alert(1)',
  "https://scontent.cdninstagram.com/x.jpg' onload='alert(1)",
  'https://scontent.cdninstagram.com/<script>alert(1)</script>.jpg',
  'https://scontent.cdninstagram.com/x.jpg?a=<img src=x onerror=alert(1)>'
];

// Storage stub that starts pre-loaded with a hostile legacy library.
function galleryWithStoredLibrary(stored) {
  const writes = [];
  const sandbox = loadGallery((s) => {
    s.chrome.runtime.id = 'test-id';
    s.chrome.storage.local.get = (_keys, cb) => cb({ igExporterData: stored });
    s.chrome.storage.local.set = (data, cb) => { writes.push(data); if (cb) cb(); };
  });
  return { sandbox, writes };
}

// ---------------------------------------------------------------------------
// The sanitiser itself, driven with stored (not imported) records
// ---------------------------------------------------------------------------

test('stored records with hostile URLs are dropped entirely', () => {
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const lib = sandbox.SBE_LIB;
  for (const url of HOSTILE_URLS) {
    const res = lib.sanitizeLibrary({
      images: [{ type: 'image', url, thumbnail: url }],
      videos: []
    });
    assert.equal(res.images.length, 0, 'must drop stored record with url: ' + url);
    assert.ok(res.removedRecords >= 1, 'must count the removal for: ' + url);
    assert.equal(res.changed, true);
  }
});

test('a hostile thumbnail is nulled without discarding a valid record', () => {
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const res = sandbox.SBE_LIB.sanitizeLibrary({
    images: [{ type: 'image', url: GOOD_IMG, thumbnail: 'javascript:alert(1)' }],
    videos: []
  });
  assert.equal(res.images.length, 1, 'the record itself is still valid, so it is kept');
  assert.equal(res.images[0].url, GOOD_IMG);
  assert.notEqual(res.images[0].thumbnail, 'javascript:alert(1)');
  assert.equal(res.images[0].thumbnail, GOOD_IMG, 'falls back to the valid media URL');
  assert.ok(res.removedFields >= 1, 'the nulled thumbnail is reported');
});

test('a post-only video record survives with a valid postUrl and no media URL', () => {
  // Requirement 8: an expired CDN link must not cost the user the record.
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const res = sandbox.SBE_LIB.sanitizeLibrary({
    images: [],
    videos: [{ type: 'video', url: null, thumbnail: null, postUrl: GOOD_POST }]
  });
  assert.equal(res.videos.length, 1, 'post-only record must be preserved');
  assert.equal(res.videos[0].url, null);
  assert.equal(res.videos[0].postUrl, GOOD_POST);
});

test('a record with a hostile postUrl but valid media keeps the media, drops the link', () => {
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const res = sandbox.SBE_LIB.sanitizeLibrary({
    images: [{ type: 'image', url: GOOD_IMG, postUrl: 'javascript:alert(1)' }],
    videos: []
  });
  assert.equal(res.images.length, 1);
  assert.equal(res.images[0].postUrl, null, 'hostile permalink must be dropped');
  assert.equal(res.images[0].url, GOOD_IMG);
});

test('a media URL is never accepted as a postUrl, and vice versa', () => {
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const res = sandbox.SBE_LIB.sanitizeLibrary({
    images: [{ type: 'image', url: GOOD_IMG, postUrl: GOOD_IMG }],
    videos: [{ type: 'video', url: GOOD_POST, postUrl: GOOD_POST }]
  });
  assert.equal(res.images[0].postUrl, null,
    'a CDN URL is not a permalink and must not become one');
  assert.equal(res.videos[0].url, null,
    'a permalink is not media and must not become player.src');
  assert.equal(res.videos[0].thumbnail, null,
    'nor may it become a thumbnail');
  assert.equal(res.videos[0].postUrl, GOOD_POST,
    'but it is preserved as the permalink, so the record survives');
});

test('extra properties on a stored record are not carried through', () => {
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const res = sandbox.SBE_LIB.sanitizeLibrary({
    images: [{
      type: 'image',
      url: GOOD_IMG,
      innerHTML: '<img src=x onerror=alert(1)>',
      outerHTML: '<script>alert(1)</script>',
      onclick: 'alert(1)',
      onerror: 'alert(1)',
      srcdoc: '<script>alert(1)</script>',
      style: 'background:url(javascript:alert(1))',
      constructor: 'nope',
      __lookupGetter__: 'nope'
    }],
    videos: []
  });
  const rec = res.images[0];
  assert.ok(rec, 'the valid record survives');
  for (const key of ['innerHTML', 'outerHTML', 'onclick', 'onerror', 'srcdoc', 'style']) {
    assert.equal(Object.prototype.hasOwnProperty.call(rec, key), false,
      'must not copy property: ' + key);
  }
  assert.deepEqual(plain(Object.keys(rec).sort()), [
    'carouselIndex', 'carouselSize', 'metadata', 'postShortcode',
    'postUrl', 'scrapedAt', 'thumbnail', 'type', 'url'
  ]);
});

test('malformed stored entries are dropped without throwing', () => {
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const lib = sandbox.SBE_LIB;
  for (const junk of [null, undefined, 'a string', 42, true, [], [[]], {},
                      { url: 12345 }, { url: { href: GOOD_IMG } }]) {
    let res;
    assert.doesNotThrow(() => {
      res = lib.sanitizeLibrary({ images: [junk], videos: [junk] });
    }, 'must not throw on: ' + JSON.stringify(junk));
    assert.equal(res.images.length, 0);
    assert.equal(res.videos.length, 0);
  }
});

test('unexpected array shapes for the library itself are handled', () => {
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const lib = sandbox.SBE_LIB;
  for (const shape of [null, undefined, 'string', 42, [], [1, 2, 3],
                       { images: 'nope', videos: 'nope' },
                       { images: {}, videos: {} }]) {
    let res;
    assert.doesNotThrow(() => { res = lib.sanitizeLibrary(shape); });
    assert.deepEqual(plain(res.images), []);
    assert.deepEqual(plain(res.videos), []);
  }
});

test('metadata fields are validated, not trusted', () => {
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const res = sandbox.SBE_LIB.sanitizeLibrary({
    images: [{
      type: 'image', url: GOOD_IMG,
      postShortcode: '../../etc/passwd',
      carouselIndex: 1e9,
      carouselSize: -5,
      scrapedAt: '<script>alert(1)</script>',
      metadata: {
        owner: '<img src=x onerror=alert(1)>',
        caption: 'x'.repeat(500000),
        takenAt: 'not a date',
        likeCount: NaN,
        hashtags: ['ok', '<script>', 'x'.repeat(500), 42, null,
                   ...Array(200).fill('spam')]
      }
    }],
    videos: []
  });
  const rec = res.images[0];
  assert.equal(rec.postShortcode, null, 'path traversal in shortcode dropped');
  assert.equal(rec.carouselIndex, null, 'out-of-range index dropped');
  assert.equal(rec.carouselSize, 1, 'negative size normalised to 1');
  assert.equal(rec.scrapedAt, null, 'unparseable timestamp dropped');
  assert.equal(rec.metadata.owner, null, 'markup in username dropped');
  assert.equal(rec.metadata.caption.length, sandbox.SBE_LIB.LIMITS.caption);
  assert.equal(rec.metadata.takenAt, null);
  assert.equal(rec.metadata.likeCount, null, 'NaN like count dropped');
  assert.ok(rec.metadata.hashtags.length <= sandbox.SBE_LIB.LIMITS.hashtags);
  assert.equal(rec.metadata.hashtags.includes('<script>'), false);
  assert.ok(rec.metadata.hashtags.includes('ok'));
});

test('list size is capped', () => {
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const cap = sandbox.SBE_LIB.LIMITS.recordsPerBucket;
  const huge = Array.from({ length: cap + 500 },
    (_, i) => ({ type: 'image', url: GOOD_IMG + '?i=' + i }));
  const res = sandbox.SBE_LIB.sanitizeLibrary({ images: huge, videos: [] });
  assert.ok(res.images.length <= cap, 'got ' + res.images.length + ', cap ' + cap);
});

// ---------------------------------------------------------------------------
// The gallery load path: hostile storage never reaches allMedia
// ---------------------------------------------------------------------------

test('gallery load sanitises hostile stored records into allMedia', () => {
  const stored = {
    images: [
      { type: 'image', url: 'javascript:alert(1)' },
      { type: 'image', url: 'https://evilcdninstagram.com/image.jpg' },
      { type: 'image', url: GOOD_IMG }
    ],
    videos: [
      { type: 'video', url: 'data:text/html,alert(1)' },
      { type: 'video', url: GOOD_VID }
    ]
  };
  const { sandbox } = galleryWithStoredLibrary(stored);
  const res = sandbox.adoptLibrary(stored, {});
  assert.equal(res.images.length, 1);
  assert.equal(res.videos.length, 1);
  assert.equal(sandbox.allMedia.images.length, 1);
  assert.equal(sandbox.allMedia.videos.length, 1);
  assert.equal(sandbox.allMedia.images[0].url, GOOD_IMG);
  assert.equal(sandbox.allMedia.videos[0].url, GOOD_VID);
});

test('adoptLibrary persists the cleaned library when it changed', () => {
  const stored = { images: [{ type: 'image', url: 'javascript:alert(1)' }], videos: [] };
  const { sandbox, writes } = galleryWithStoredLibrary(stored);
  const before = writes.filter(w => w.igExporterData).length;
  sandbox.adoptLibrary(stored, { persist: true });
  const dataWrites = writes.filter(w => w.igExporterData);
  assert.equal(dataWrites.length, before + 1, 'the cleaned library must be written back');
  const last = dataWrites[dataWrites.length - 1];
  assert.deepEqual(plain(last.igExporterData), { images: [], videos: [] });
  assert.ok(last.sbeLibrarySanitizedAt, 'an audit marker is recorded');
});

test('adoptLibrary does NOT rewrite an already-clean library (no feedback loop)', () => {
  const clean = {
    images: [{
      type: 'image', url: GOOD_IMG, thumbnail: GOOD_IMG, postUrl: GOOD_POST,
      postShortcode: 'Cabc123_', carouselIndex: null, carouselSize: 1,
      metadata: null, scrapedAt: '2026-01-01T00:00:00.000Z'
    }],
    videos: []
  };
  const { sandbox, writes } = galleryWithStoredLibrary(clean);
  const before = writes.filter(w => w.igExporterData).length;
  const res = sandbox.adoptLibrary(clean, { persist: true });
  assert.equal(res.changed, false, 'a clean library reports no change');
  assert.equal(writes.filter(w => w.igExporterData).length, before,
    'no write means storage.onChanged does not re-fire — the loop cannot start');
});

test('sanitising twice is idempotent', () => {
  const stored = {
    images: [{ type: 'image', url: GOOD_IMG, thumbnail: 'javascript:alert(1)' }],
    videos: []
  };
  const { sandbox } = galleryWithStoredLibrary(stored);
  const first = sandbox.SBE_LIB.sanitizeLibrary(stored);
  assert.equal(first.changed, true);
  const second = sandbox.SBE_LIB.sanitizeLibrary(
    { images: first.images, videos: first.videos });
  assert.equal(second.changed, false, 'second pass finds nothing left to clean');
  assert.deepEqual(plain(second.images), plain(first.images));
});

test('adoptLibrary fails closed when the sanitiser is missing', () => {
  const sandbox = loadGallery((s) => { s.chrome.runtime.id = 'test-id'; });
  // Simulate library-sanitize.js having failed to load. adoptLibrary reads
  // globalThis.SBE_LIB at call time, so clearing it here is what the code sees.
  sandbox.SBE_LIB = undefined;
  const res = sandbox.adoptLibrary({
    images: [{ type: 'image', url: GOOD_IMG }], videos: []
  }, {});
  assert.deepEqual(plain(res.images), [], 'no sanitiser means no records, not raw records');
  assert.deepEqual(plain(sandbox.allMedia.images), []);
});

test('the number of removed records and fields is reported to the user', () => {
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const res = sandbox.SBE_LIB.sanitizeLibrary({
    images: [
      { type: 'image', url: 'javascript:alert(1)' },
      { type: 'image', url: 'file:///etc/passwd' },
      { type: 'image', url: GOOD_IMG, thumbnail: 'data:text/html,x' }
    ],
    videos: []
  });
  assert.equal(res.removedRecords, 2);
  assert.ok(res.removedFields >= 1);
  const msg = sandbox.SBE_LIB.describeRemoval(res);
  assert.match(msg, /Removed/);
  assert.match(msg, /2 unsafe records/);
  assert.match(msg, /older captured data/);
});

// ---------------------------------------------------------------------------
// content.js must not re-persist legacy records either
// ---------------------------------------------------------------------------

test('content.js sanitises the library it loads from storage', () => {
  const writes = [];
  const { exposed } = loadContent((s) => {
    s.chrome.runtime.id = 'test-id';
    s.chrome.storage.local.get = (_keys, cb) => cb({
      igExporterData: {
        images: [
          { type: 'image', url: 'javascript:alert(1)' },
          { type: 'image', url: GOOD_IMG }
        ],
        videos: [{ type: 'video', url: 'https://evil.example/x.mp4' }]
      }
    });
    s.chrome.storage.local.set = (data, cb) => { writes.push(data); if (cb) cb(); };
  });
  // init() runs on 'load', which the sandbox never fires; call the seam directly.
  exposed.loadFromStorage();
  assert.equal(exposed.state.images.length, 1,
    'only the allowlisted image survives the load');
  assert.equal(exposed.state.images[0].url, GOOD_IMG);
  assert.equal(exposed.state.videos.length, 0);
  const dataWrites = writes.filter(w => w.igExporterData);
  assert.ok(dataWrites.length >= 1,
    'content.js must persist the cleaned library so the unsafe values are gone ' +
    'even if the gallery is never opened');
  assert.equal(dataWrites[dataWrites.length - 1].igExporterData.images.length, 1);
  assert.equal(dataWrites[dataWrites.length - 1].igExporterData.videos.length, 0);
});

// ---------------------------------------------------------------------------
// Complete change detection (4.4.3)
// ---------------------------------------------------------------------------
// 4.4.2 derived `changed` only from the rejection tally, so a record could be
// REBUILT differently without anything being counted — an unknown `innerHTML`
// property dropped, a bad `type` normalised, a caption truncated. In every such
// case the in-memory object was safe but storage still held the unsafe
// original, and because `changed` was false, `persist` never fired. The claim
// that unsafe legacy values are permanently removed was therefore untrue.

const TRANSFORMS = [
  {
    name: 'unknown hostile properties are dropped',
    rec: { type: 'image', url: GOOD_IMG,
           innerHTML: '<img src=x onerror=alert(1)>', onclick: 'alert(2)',
           srcdoc: '<script>alert(3)</script>', style: 'background:url(javascript:alert(4))' }
  },
  { name: 'invalid type is normalised',      rec: { type: 'AUDIO', url: GOOD_IMG } },
  { name: 'missing type is defaulted',       rec: { url: GOOD_IMG } },
  { name: 'negative carouselSize normalised',rec: { type: 'image', url: GOOD_IMG, carouselSize: -5 } },
  { name: 'huge carouselSize normalised',    rec: { type: 'image', url: GOOD_IMG, carouselSize: 9999 } },
  { name: 'out-of-range carouselIndex dropped', rec: { type: 'image', url: GOOD_IMG, carouselIndex: 1e9 } },
  { name: 'over-long caption truncated',
    rec: { type: 'image', url: GOOD_IMG, metadata: { caption: 'x'.repeat(50000) } } },
  { name: 'extra metadata properties removed',
    rec: { type: 'image', url: GOOD_IMG, metadata: { owner: 'ok', evilKey: 'x', onclick: 'y' } } },
  { name: 'over-long hashtag list truncated',
    rec: { type: 'image', url: GOOD_IMG,
           metadata: { hashtags: Array.from({ length: 400 }, (_, i) => 'tag' + i) } } },
  { name: 'prototype-ish keys dropped',
    rec: { type: 'image', url: GOOD_IMG, constructor: 'x', __defineGetter__: 'y' } }
];

for (const t of TRANSFORMS) {
  test('changed=true when ' + t.name, () => {
    const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
    const res = sandbox.SBE_LIB.sanitizeLibrary({ images: [t.rec], videos: [] });
    assert.equal(res.images.length, 1, 'the record itself is still valid and kept');
    assert.equal(res.changed, true,
      'the record was rebuilt differently, so storage still holds the old form');
  });
}

test('adoptLibrary persists a rebuilt record even when nothing was "rejected"', () => {
  const stored = {
    images: [{
      type: 'image', url: GOOD_IMG,
      innerHTML: '<img src=x onerror=alert(1)>',
      onclick: 'alert(2)',
      srcdoc: '<script>alert(3)</script>',
      style: 'background:url(javascript:alert(4))'
    }],
    videos: []
  };
  const { sandbox, writes } = galleryWithStoredLibrary(stored);
  const before = writes.filter(w => w.igExporterData).length;
  const res = sandbox.adoptLibrary(stored, { persist: true });

  assert.equal(res.changed, true);
  assert.equal(res.removedRecords, 0, 'nothing was rejected — that was the trap');
  const dataWrites = writes.filter(w => w.igExporterData);
  assert.equal(dataWrites.length, before + 1, 'the rebuilt record MUST be written back');

  const written = plain(dataWrites[dataWrites.length - 1].igExporterData);
  const blob = JSON.stringify(written);
  for (const bad of ['innerHTML', 'onclick', 'srcdoc', 'javascript:']) {
    assert.equal(blob.includes(bad), false,
      'the persisted record must not carry: ' + bad);
  }
  assert.equal(written.images.length, 1);
  assert.equal(written.images[0].url, GOOD_IMG);
});

test('truncation and normalisation are persisted too', () => {
  const stored = {
    images: [{ type: 'BOGUS', url: GOOD_IMG, carouselSize: -3,
               metadata: { caption: 'y'.repeat(9000) } }],
    videos: []
  };
  const { sandbox, writes } = galleryWithStoredLibrary(stored);
  const before = writes.filter(w => w.igExporterData).length;
  const res = sandbox.adoptLibrary(stored, { persist: true });
  assert.equal(res.changed, true);
  assert.equal(writes.filter(w => w.igExporterData).length, before + 1);
  const written = plain(writes.filter(w => w.igExporterData).pop().igExporterData);
  assert.equal(written.images[0].type, 'image', 'type normalised');
  assert.equal(written.images[0].carouselSize, 1, 'size normalised');
  assert.equal(written.images[0].metadata.caption.length,
    sandbox.SBE_LIB.LIMITS.caption, 'caption truncated');
});

test('sanitising the rebuilt output reports changed=false (fixed point)', () => {
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const lib = sandbox.SBE_LIB;
  for (const t of TRANSFORMS) {
    const first = lib.sanitizeLibrary({ images: [t.rec], videos: [] });
    assert.equal(first.changed, true, t.name + ': first pass changes');
    const second = lib.sanitizeLibrary({ images: first.images, videos: first.videos });
    assert.equal(second.changed, false,
      t.name + ': second pass must be a no-op, or storage rewrites forever');
    assert.deepEqual(plain(second.images), plain(first.images));
  }
});

test('a genuinely canonical clean library causes no write at all', () => {
  const canonical = {
    images: [{
      type: 'image', url: GOOD_IMG, thumbnail: GOOD_IMG, postUrl: GOOD_POST,
      postShortcode: 'Cabc123_', carouselIndex: 0, carouselSize: 2,
      metadata: { caption: 'hi', owner: 'someone', takenAt: null,
                  likeCount: 3, hashtags: ['tag'] },
      scrapedAt: '2026-01-01T00:00:00.000Z'
    }],
    videos: []
  };
  const { sandbox, writes } = galleryWithStoredLibrary(canonical);
  const before = writes.filter(w => w.igExporterData).length;
  const res = sandbox.adoptLibrary(canonical, { persist: true });
  assert.equal(res.changed, false, 'nothing to do');
  assert.equal(writes.filter(w => w.igExporterData).length, before,
    'no write means storage.onChanged does not re-fire — no feedback loop');
});

test('change detection is insensitive to property ORDER', () => {
  // An order-sensitive comparison would rewrite storage on every single load,
  // forever. Two records with identical values but different key insertion
  // order must compare equal.
  const { sandbox } = galleryWithStoredLibrary({ images: [], videos: [] });
  const lib = sandbox.SBE_LIB;
  const a = { type: 'image', url: GOOD_IMG, thumbnail: GOOD_IMG, postUrl: null,
              postShortcode: null, carouselIndex: null, carouselSize: 1,
              metadata: null, scrapedAt: null };
  const b = { scrapedAt: null, metadata: null, carouselSize: 1,
              carouselIndex: null, postShortcode: null, postUrl: null,
              thumbnail: GOOD_IMG, url: GOOD_IMG, type: 'image' };
  assert.equal(lib.canonicalRecord(a), lib.canonicalRecord(b),
    'same values, different key order -> same canonical form');
  assert.equal(lib.sanitizeLibrary({ images: [a], videos: [] }).changed, false);
  assert.equal(lib.sanitizeLibrary({ images: [b], videos: [] }).changed, false);
});

test('content.js persists every transformation, not only rejected URLs', () => {
  const writes = [];
  const { exposed } = loadContent((s) => {
    s.chrome.runtime.id = 'test-id';
    s.chrome.storage.local.get = (_k, cb) => cb({
      igExporterData: {
        // Nothing here is REJECTED — the URL is fine. Only unknown properties
        // are dropped and the type normalised. 4.4.2 would not have persisted.
        images: [{ type: 'nonsense', url: GOOD_IMG,
                   innerHTML: '<img src=x onerror=alert(1)>',
                   onclick: 'alert(2)' }],
        videos: []
      }
    });
    s.chrome.storage.local.set = (d, cb) => { writes.push(d); if (cb) cb(); };
  });
  exposed.loadFromStorage();
  assert.equal(exposed.state.images.length, 1);
  const dataWrites = writes.filter(w => w.igExporterData);
  assert.ok(dataWrites.length >= 1,
    'content.js must persist the rebuilt record even with zero rejections');
  const blob = JSON.stringify(plain(dataWrites[dataWrites.length - 1].igExporterData));
  assert.equal(blob.includes('innerHTML'), false);
  assert.equal(blob.includes('onclick'), false);
  assert.match(blob, /"type":"image"/);
});
