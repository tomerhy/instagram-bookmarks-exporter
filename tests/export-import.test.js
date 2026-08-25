// Tests for the v4.3.6 export/import overhaul.
//
// Pre-v4.3.6 behaviour was broken in two ways:
//   1. Export only wrote URLs from the active tab — videos were lost if you
//      were on the images tab, and vice versa.
//   2. The .txt URL-per-line format had no room for metadata, so importing
//      a backup produced items missing owner, caption, carouselSize, etc.
//
// The fix is a JSON format that carries both arrays with full fidelity, plus
// a backward-compat fallback so users who still have .txt exports can import
// them. These tests pin the schema and the parsing branches.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTopLevel } = require('./_setup');

function loadGallery() {
  return loadTopLevel('gallery.js');
}

// Cross-realm deep-equal. gallery.js runs in a vm sandbox so its arrays have
// a different Array.prototype than the test runner's arrays; node's strict
// deepEqual rejects that even when the contents match. Stringify both sides
// into our realm before comparing.
function deepEq(actual, expected, msg) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(actual)),
    JSON.parse(JSON.stringify(expected)),
    msg
  );
}

// ---------- buildExportPayload ----------

test('buildExportPayload: produces the v1 schema with both tabs', () => {
  const g = loadGallery();
  const payload = g.buildExportPayload(
    [{ type: 'image', url: 'a.jpg' }],
    [{ type: 'video', url: 'b.mp4' }],
    '4.3.6'
  );
  assert.equal(payload.format, 'saved-posts-backup-export');
  assert.equal(payload.formatVersion, 1);
  assert.equal(payload.extensionVersion, '4.3.6');
  assert.ok(payload.exportedAt && !isNaN(new Date(payload.exportedAt).getTime()),
    'exportedAt should be a valid ISO timestamp');
  deepEq(payload.images, [{ type: 'image', url: 'a.jpg' }]);
  deepEq(payload.videos, [{ type: 'video', url: 'b.mp4' }]);
});

test('buildExportPayload: preserves metadata, carouselSize, postUrl, scrapedAt', () => {
  const g = loadGallery();
  const rich = {
    type: 'image',
    url: 'https://cdn/x.jpg',
    thumbnail: 'https://cdn/x_thumb.jpg',
    postUrl: 'https://instagram.com/p/ABC',
    postShortcode: 'ABC',
    carouselSize: 5,
    carouselIndex: 2,
    scrapedAt: '2026-05-22T10:00:00.000Z',
    metadata: {
      owner: 'someuser',
      caption: 'Hello\nworld',
      takenAt: '2026-05-20T09:00:00.000Z'
    }
  };
  const payload = g.buildExportPayload([rich], []);
  // Deep-equal proves nothing was stripped or coerced.
  deepEq(payload.images[0], rich,
    'metadata must round-trip unchanged — that was the original bug');
});

test('buildExportPayload: empty arrays produce a valid empty payload', () => {
  const g = loadGallery();
  const payload = g.buildExportPayload([], []);
  assert.equal(payload.images.length, 0);
  assert.equal(payload.videos.length, 0);
  assert.equal(payload.formatVersion, 1);
});

test('buildExportPayload: non-array inputs are normalized to []', () => {
  const g = loadGallery();
  const payload = g.buildExportPayload(null, undefined);
  assert.equal(payload.images.length, 0);
  assert.equal(payload.videos.length, 0);
});

test('buildExportPayload: returned arrays are shallow copies (mutating result does not poison state)', () => {
  const g = loadGallery();
  const images = [{ type: 'image', url: 'a.jpg' }];
  const payload = g.buildExportPayload(images, []);
  payload.images.push({ type: 'image', url: 'rogue.jpg' });
  assert.equal(images.length, 1, 'original input array should not have been mutated');
});

test('buildExportPayload: result is JSON-serializable (no cycles, no exotic types)', () => {
  const g = loadGallery();
  const payload = g.buildExportPayload(
    [{ type: 'image', url: 'a.jpg', metadata: { caption: 'with "quotes"' } }],
    []
  );
  assert.doesNotThrow(() => JSON.stringify(payload));
  const round = JSON.parse(JSON.stringify(payload));
  assert.equal(round.images[0].metadata.caption, 'with "quotes"');
});

// ---------- parseImportPayload ----------

test('parseImportPayload: parses a v1 JSON export', () => {
  const g = loadGallery();
  const json = JSON.stringify({
    format: 'saved-posts-backup-export',
    formatVersion: 1,
    images: [{ type: 'image', url: 'a.jpg', metadata: { owner: 'u1' } }],
    videos: [{ type: 'video', url: 'b.mp4' }]
  });
  const result = g.parseImportPayload(json);
  assert.equal(result.format, 'json');
  assert.equal(result.images.length, 1);
  assert.equal(result.videos.length, 1);
  assert.equal(result.images[0].metadata.owner, 'u1',
    'metadata should survive the parse');
});

test('parseImportPayload: JSON missing both images and videos throws', () => {
  const g = loadGallery();
  assert.throws(() => g.parseImportPayload('{"foo":"bar"}'),
    /does not contain images\/videos/);
});

test('parseImportPayload: JSON with only images (no videos key) still works', () => {
  const g = loadGallery();
  const result = g.parseImportPayload('{"images":[{"url":"a.jpg"}]}');
  assert.equal(result.format, 'json');
  assert.equal(result.images.length, 1);
  assert.equal(result.videos.length, 0);
});

test('parseImportPayload: malformed JSON throws with a parse message', () => {
  const g = loadGallery();
  assert.throws(() => g.parseImportPayload('{ this is not json'),
    /Invalid JSON/);
});

test('parseImportPayload: falls back to txt URL-list (legacy .txt exports)', () => {
  const g = loadGallery();
  const text = 'https://cdn/a.jpg\nhttps://cdn/b.jpg\nhttps://cdn/c.jpg';
  const result = g.parseImportPayload(text);
  assert.equal(result.format, 'txt');
  deepEq(result.urls, ['https://cdn/a.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg']);
});

test('parseImportPayload: txt strips blank lines and whitespace', () => {
  const g = loadGallery();
  const text = '\n  https://cdn/a.jpg  \n\nhttps://cdn/b.jpg\n   \n';
  const result = g.parseImportPayload(text);
  deepEq(result.urls, ['https://cdn/a.jpg', 'https://cdn/b.jpg']);
});

test('parseImportPayload: empty input throws', () => {
  const g = loadGallery();
  assert.throws(() => g.parseImportPayload(''), /Empty file/);
  assert.throws(() => g.parseImportPayload('   \n  '), /Empty file/);
});

test('parseImportPayload: whitespace-only-around-JSON is fine', () => {
  const g = loadGallery();
  const result = g.parseImportPayload('   \n  {"images":[]} \n  ');
  assert.equal(result.format, 'json');
});

// ---------- Round-trip ----------

test('round-trip: export → JSON → parse → identical data', () => {
  const g = loadGallery();
  const originalImages = [
    {
      type: 'image',
      url: 'https://cdn/photo.jpg',
      postUrl: 'https://instagram.com/p/SHORT',
      postShortcode: 'SHORT',
      carouselSize: 3,
      carouselIndex: 0,
      scrapedAt: '2026-04-01T12:00:00.000Z',
      metadata: { owner: 'photog', caption: 'Spring day' }
    }
  ];
  const originalVideos = [
    {
      type: 'video',
      url: 'https://cdn/clip.mp4',
      thumbnail: 'https://cdn/clip_thumb.jpg',
      scrapedAt: '2026-04-02T08:30:00.000Z'
    }
  ];

  const payload = g.buildExportPayload(originalImages, originalVideos, '4.3.6');
  const serialized = JSON.stringify(payload);
  const parsed = g.parseImportPayload(serialized);

  assert.equal(parsed.format, 'json');
  deepEq(parsed.images, originalImages,
    'images should round-trip with full metadata intact');
  deepEq(parsed.videos, originalVideos,
    'videos should round-trip with full metadata intact');
});
