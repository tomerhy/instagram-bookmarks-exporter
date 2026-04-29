// Tests for the persisted item shape (buildItem) and the dedup behavior of
// addImage/addVideo. This is the "data layer" — wrong shape here breaks the
// gallery silently, so pin the field set explicitly.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadIIFE } = require('./_setup');

function freshContent() {
  // Fresh sandbox for each test so state doesn't leak between cases.
  const { exposed } = loadIIFE('content.js');
  return exposed;
}

// ---------- buildItem ----------

test('buildItem: image without options has all expected fields', () => {
  const { buildItem } = freshContent();
  const item = buildItem('image', 'https://cdn/x.jpg', null, 'https://cdn/x.jpg', null);
  assert.equal(item.type, 'image');
  assert.equal(item.url, 'https://cdn/x.jpg');
  assert.equal(item.thumbnail, 'https://cdn/x.jpg');
  assert.equal(item.postUrl, null);
  assert.equal(item.postShortcode, null);
  assert.equal(item.carouselIndex, null);
  assert.equal(item.carouselSize, 1);
  assert.equal(item.metadata, null);
  assert.ok(item.scrapedAt, 'scrapedAt should be set');
  assert.ok(!isNaN(new Date(item.scrapedAt).getTime()), 'scrapedAt should be valid ISO');
});

test('buildItem: derives postUrl from postShortcode when not provided', () => {
  const { buildItem } = freshContent();
  const item = buildItem('image', 'https://cdn/x.jpg', null, null, { postShortcode: 'Cabc' });
  assert.equal(item.postUrl, 'https://www.instagram.com/p/Cabc/');
  assert.equal(item.postShortcode, 'Cabc');
});

test('buildItem: explicit postUrl wins over shortcode-derived', () => {
  const { buildItem } = freshContent();
  const item = buildItem('video', 'https://cdn/v.mp4', 'https://www.instagram.com/explicit/', null, { postShortcode: 'Cabc' });
  assert.equal(item.postUrl, 'https://www.instagram.com/explicit/');
});

test('buildItem: video preserves null thumbnail (no fallback to URL)', () => {
  const { buildItem } = freshContent();
  const item = buildItem('video', 'https://cdn/v.mp4', null, null, null);
  assert.equal(item.thumbnail, null);
});

test('buildItem: image falls back thumbnail to url when missing', () => {
  const { buildItem } = freshContent();
  const item = buildItem('image', 'https://cdn/x.jpg', null, null, null);
  assert.equal(item.thumbnail, 'https://cdn/x.jpg');
});

test('buildItem: carousel slide records its index', () => {
  const { buildItem } = freshContent();
  const item = buildItem('image', 'https://cdn/2.jpg', null, null, {
    postShortcode: 'Calbum', carouselIndex: 2, carouselSize: 5
  });
  assert.equal(item.carouselIndex, 2);
  assert.equal(item.carouselSize, 5);
});

test('buildItem: carouselIndex 0 (first slide) is preserved, not coerced to null', () => {
  const { buildItem } = freshContent();
  const item = buildItem('image', 'https://cdn/0.jpg', null, null, {
    postShortcode: 'C', carouselIndex: 0, carouselSize: 3
  });
  assert.equal(item.carouselIndex, 0);
});

// ---------- addImage / addVideo dedup ----------

test('addImage: returns true on first add, false on duplicate', () => {
  const c = freshContent();
  c.state.images.length = 0;
  c.state.seenUrls.clear();

  assert.equal(c.addImage('https://cdn/a.jpg?ig_cache_key=K1&stp=p', null, null, null), true);
  assert.equal(c.state.images.length, 1);
  // Same logical URL with different signing params → still a dupe
  assert.equal(c.addImage('https://cdn/a.jpg?ig_cache_key=K1&stp=p&_nc_ht=different', null, null, null), false);
  assert.equal(c.state.images.length, 1);
});

test('addImage: rejects empty URL', () => {
  const c = freshContent();
  c.state.images.length = 0;
  c.state.seenUrls.clear();
  assert.equal(c.addImage(null, null, null, null), false);
  assert.equal(c.addImage('', null, null, null), false);
  assert.equal(c.state.images.length, 0);
});

test('addImage: persists shortcode + carouselIndex from options', () => {
  const c = freshContent();
  c.state.images.length = 0;
  c.state.seenUrls.clear();
  c.addImage('https://cdn/x.jpg', null, null, {
    postShortcode: 'Cpost', carouselIndex: 1, carouselSize: 3,
    metadata: { caption: 'hi', owner: 'me', takenAt: null, likeCount: null, hashtags: [] }
  });
  const stored = c.state.images[0];
  assert.equal(stored.postShortcode, 'Cpost');
  assert.equal(stored.carouselIndex, 1);
  assert.equal(stored.carouselSize, 3);
  assert.equal(stored.metadata.owner, 'me');
});

test('addVideo: dedup by URL works the same as addImage', () => {
  const c = freshContent();
  c.state.videos.length = 0;
  c.state.seenUrls.clear();
  assert.equal(c.addVideo('https://cdn/v.mp4', null, null, null), true);
  assert.equal(c.addVideo('https://cdn/v.mp4', null, null, null), false);
  assert.equal(c.state.videos.length, 1);
});

test('addVideo: dedup by postUrl when video URL is missing', () => {
  const c = freshContent();
  c.state.videos.length = 0;
  c.state.seenUrls.clear();
  // Some captures yield postUrl only (e.g. video icon spotted but no direct CDN URL yet)
  assert.equal(c.addVideo(null, 'https://www.instagram.com/p/Cabc/', null, null), true);
  assert.equal(c.addVideo(null, 'https://www.instagram.com/p/Cabc/', null, null), false);
  assert.equal(c.state.videos.length, 1);
});

test('addVideo: rejects when both URL and postUrl are missing', () => {
  const c = freshContent();
  c.state.videos.length = 0;
  c.state.seenUrls.clear();
  assert.equal(c.addVideo(null, null, null, null), false);
  assert.equal(c.state.videos.length, 0);
});

test('addImage + addVideo: cross-type dedup for same logical URL', () => {
  // Edge case: if the same URL was somehow classified as both, dedup should
  // still fire (seenUrls is shared across types).
  const c = freshContent();
  c.state.images.length = 0;
  c.state.videos.length = 0;
  c.state.seenUrls.clear();
  assert.equal(c.addImage('https://cdn/same.jpg', null, null, null), true);
  assert.equal(c.addVideo('https://cdn/same.jpg', null, null, null), false);
  assert.equal(c.state.images.length, 1);
  assert.equal(c.state.videos.length, 0);
});
