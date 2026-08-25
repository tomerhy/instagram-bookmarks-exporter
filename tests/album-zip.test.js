// Tests for the v4.4.0 per-album ZIP download.
//
// downloadAlbum() is the integration driver — fetches each slide, packs
// via JSZip, triggers a download. We don't unit-test that path here; the
// fetch + JSZip + DOM interaction belongs in manual / e2e QA.
//
// What we DO test: the pure helpers that decide what goes into the zip.
//   - albumFilename(slide, idx, total): zero-padded sequential names
//   - _slideExtension(slide): jpg / mp4 / etc. picked correctly
//   - buildAlbumManifest(item): the manifest.json content
//
// These are the things a future change could break silently, and they're
// the contract that anyone unzipping the file will see.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTopLevel } = require('./_setup');

function loadGallery() {
  return loadTopLevel('gallery.js');
}

// Cross-realm safe deepEqual via JSON round-trip.
function deepEq(actual, expected, msg) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(actual)),
    JSON.parse(JSON.stringify(expected)),
    msg
  );
}

// ---------- _slideExtension ----------

test('_slideExtension: known image extensions in the URL pass through', () => {
  const g = loadGallery();
  assert.equal(g._slideExtension({ url: 'https://cdn/a.jpg' }), 'jpg');
  assert.equal(g._slideExtension({ url: 'https://cdn/a.png' }), 'png');
  assert.equal(g._slideExtension({ url: 'https://cdn/a.webp' }), 'webp');
});

test('_slideExtension: .jpeg normalized to .jpg', () => {
  const g = loadGallery();
  assert.equal(g._slideExtension({ url: 'https://cdn/a.jpeg' }), 'jpg');
});

test('_slideExtension: query strings and signed-URL params are stripped first', () => {
  const g = loadGallery();
  assert.equal(
    g._slideExtension({ url: 'https://cdn/a.jpg?stp=dst-jpg_e35&ig_cache_key=xyz' }),
    'jpg'
  );
  assert.equal(g._slideExtension({ url: 'https://cdn/a.mp4#fragment' }), 'mp4');
});

test('_slideExtension: video type falls back to mp4 when URL lacks an extension', () => {
  const g = loadGallery();
  assert.equal(g._slideExtension({ url: 'https://cdn/no-ext', type: 'video' }), 'mp4');
});

test('_slideExtension: image type falls back to jpg when URL lacks an extension', () => {
  const g = loadGallery();
  assert.equal(g._slideExtension({ url: 'https://cdn/no-ext', type: 'image' }), 'jpg');
});

test('_slideExtension: unknown extension in URL defers to type-based fallback', () => {
  const g = loadGallery();
  // .xyz isn't on our allowlist → ignore it; type is image → "jpg"
  assert.equal(g._slideExtension({ url: 'https://cdn/a.xyz', type: 'image' }), 'jpg');
});

test('_slideExtension: nothing usable → .bin (never nameless)', () => {
  const g = loadGallery();
  assert.equal(g._slideExtension({}), 'bin');
  assert.equal(g._slideExtension(null), 'bin');
});

// ---------- albumFilename ----------

test('albumFilename: zero-pads to the width of the total count', () => {
  const g = loadGallery();
  // 5 slides → single digit
  assert.equal(g.albumFilename({ url: 'a.jpg' }, 0, 5), '1.jpg');
  assert.equal(g.albumFilename({ url: 'a.jpg' }, 4, 5), '5.jpg');

  // 12 slides → 2-digit padding
  assert.equal(g.albumFilename({ url: 'a.jpg' }, 0, 12),  '01.jpg');
  assert.equal(g.albumFilename({ url: 'a.jpg' }, 9, 12),  '10.jpg');
  assert.equal(g.albumFilename({ url: 'a.jpg' }, 11, 12), '12.jpg');

  // 100 slides → 3-digit padding
  assert.equal(g.albumFilename({ url: 'a.jpg' }, 0, 100), '001.jpg');
  assert.equal(g.albumFilename({ url: 'a.jpg' }, 99, 100), '100.jpg');
});

test('albumFilename: index is 1-based in the output (UI consistency)', () => {
  const g = loadGallery();
  // idx=0 → "1.jpg" because humans count from 1
  assert.equal(g.albumFilename({ url: 'a.jpg' }, 0, 3), '1.jpg');
});

test('albumFilename: extension follows the slide, not the position', () => {
  const g = loadGallery();
  // Mixed-media album (rare but possible for reels-mixed posts)
  assert.equal(g.albumFilename({ url: 'a.jpg', type: 'image' }, 0, 3), '1.jpg');
  assert.equal(g.albumFilename({ url: 'b.mp4', type: 'video' }, 1, 3), '2.mp4');
});

// ---------- buildAlbumManifest ----------

test('buildAlbumManifest: returns null for null/undefined item (defensive)', () => {
  const g = loadGallery();
  assert.equal(g.buildAlbumManifest(null), null);
  assert.equal(g.buildAlbumManifest(undefined), null);
});

test('buildAlbumManifest: minimal item with no carousel yields a single-slide manifest', () => {
  const g = loadGallery();
  const item = {
    type: 'image',
    url: 'https://cdn/x.jpg',
    postShortcode: 'ABC'
  };
  const manifest = g.buildAlbumManifest(item, '4.4.0');
  assert.equal(manifest.format, 'saved-posts-backup-export-album');
  assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.extensionVersion, '4.4.0');
  assert.equal(manifest.shortcode, 'ABC');
  assert.equal(manifest.slides.length, 1);
  assert.equal(manifest.slides[0].filename, '1.jpg');
  assert.equal(manifest.slides[0].url, 'https://cdn/x.jpg');
});

test('buildAlbumManifest: preserves metadata for the post (caption, owner, etc.)', () => {
  const g = loadGallery();
  const item = {
    postShortcode: 'XYZ',
    postUrl: 'https://instagram.com/p/XYZ',
    metadata: {
      owner: 'photog',
      caption: 'Spring day at the beach',
      takenAt: '2026-04-12T15:30:00.000Z',
      likeCount: 1234,
      hashtags: ['travel', 'beach']
    },
    _carouselSlides: [
      { url: 'https://cdn/1.jpg', type: 'image', carouselIndex: 0 },
      { url: 'https://cdn/2.jpg', type: 'image', carouselIndex: 1 }
    ]
  };
  const manifest = g.buildAlbumManifest(item);
  assert.equal(manifest.shortcode, 'XYZ');
  assert.equal(manifest.postUrl, 'https://instagram.com/p/XYZ');
  assert.equal(manifest.owner, 'photog');
  assert.equal(manifest.caption, 'Spring day at the beach');
  assert.equal(manifest.likeCount, 1234);
  deepEq(manifest.hashtags, ['travel', 'beach']);
});

test('buildAlbumManifest: slides list contains an entry per carousel slide, in order', () => {
  const g = loadGallery();
  const item = {
    postShortcode: 'XYZ',
    _carouselSlides: [
      { url: 'https://cdn/1.jpg', type: 'image', carouselIndex: 0 },
      { url: 'https://cdn/2.mp4', type: 'video', carouselIndex: 1 },
      { url: 'https://cdn/3.jpg', type: 'image', carouselIndex: 2 }
    ]
  };
  const manifest = g.buildAlbumManifest(item);
  assert.equal(manifest.slides.length, 3);
  assert.equal(manifest.slides[0].filename, '1.jpg');
  assert.equal(manifest.slides[1].filename, '2.mp4', 'mixed media: video slide keeps its mp4 extension');
  assert.equal(manifest.slides[2].filename, '3.jpg');
});

test('buildAlbumManifest: hashtags returns a copy so mutating it doesn\'t poison the item', () => {
  const g = loadGallery();
  const tags = ['x', 'y'];
  const item = { postShortcode: 'X', metadata: { hashtags: tags } };
  const manifest = g.buildAlbumManifest(item);
  manifest.hashtags.push('rogue');
  assert.equal(tags.length, 2, 'original array should not be mutated');
});

test('buildAlbumManifest: missing metadata → null fields, not undefined', () => {
  const g = loadGallery();
  const item = { postShortcode: 'X', _carouselSlides: [{ url: 'a.jpg', type: 'image' }] };
  const manifest = g.buildAlbumManifest(item);
  assert.equal(manifest.owner, null);
  assert.equal(manifest.caption, null);
  assert.equal(manifest.takenAt, null);
  assert.equal(manifest.likeCount, null);
  deepEq(manifest.hashtags, []);
});

test('buildAlbumManifest: non-numeric likeCount drops to null (not "0", not NaN)', () => {
  const g = loadGallery();
  const item = {
    postShortcode: 'X',
    metadata: { likeCount: '1000' }, // string
    _carouselSlides: [{ url: 'a.jpg' }]
  };
  const manifest = g.buildAlbumManifest(item);
  assert.equal(manifest.likeCount, null,
    'non-numeric likeCount should be null so consumers don\'t misread strings as counts');
});

test('buildAlbumManifest: result is JSON-serializable end-to-end (no cycles, no exotic types)', () => {
  const g = loadGallery();
  const item = {
    postShortcode: 'X',
    metadata: { owner: 'a', caption: 'b with "quotes" and a comma,' },
    _carouselSlides: [{ url: 'a.jpg', type: 'image' }]
  };
  const manifest = g.buildAlbumManifest(item);
  assert.doesNotThrow(() => JSON.stringify(manifest));
  const roundtrip = JSON.parse(JSON.stringify(manifest));
  assert.equal(roundtrip.caption, 'b with "quotes" and a comma,');
});

test('buildAlbumManifest: exportedAt is a valid ISO timestamp', () => {
  const g = loadGallery();
  const manifest = g.buildAlbumManifest({ postShortcode: 'X', _carouselSlides: [{ url: 'a.jpg' }] });
  assert.ok(manifest.exportedAt && !isNaN(new Date(manifest.exportedAt).getTime()),
    'exportedAt should parse as a valid Date');
});
