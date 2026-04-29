// Tests for the gallery's carousel-grouping logic in getCurrentItems.
// Covers QA section 3 ("Album mode — carousel grouping") at the unit level:
// the integration counterpart (does the badge actually render?) is manual.
//
// gallery.js is a top-level script, so vm.runInContext attaches its function
// declarations and top-level vars to the sandbox. We poke `allMedia` and
// `currentTab` directly, then call `getCurrentItems()`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTopLevel } = require('./_setup');

function loadGallery() {
  return loadTopLevel('gallery.js');
}

function setItems(sandbox, tab, items) {
  sandbox.allMedia.images = [];
  sandbox.allMedia.videos = [];
  sandbox.allMedia[tab === 'images' ? 'images' : 'videos'] = items;
  sandbox.currentTab = tab;
}

// ---------- single items, no grouping ----------

test('getCurrentItems: items without postShortcode pass through individually', () => {
  const g = loadGallery();
  setItems(g, 'images', [
    { type: 'image', url: 'https://cdn/a.jpg', thumbnail: 'https://cdn/a.jpg' },
    { type: 'image', url: 'https://cdn/b.jpg', thumbnail: 'https://cdn/b.jpg' }
  ]);
  const result = g.getCurrentItems();
  assert.equal(result.length, 2);
  assert.equal(result[0].url, 'https://cdn/a.jpg');
  assert.equal(result[1].url, 'https://cdn/b.jpg');
  // No grouping artifacts on individual items
  assert.equal(result[0]._carouselSlides, undefined);
});

test('getCurrentItems: deduplicates by URL', () => {
  const g = loadGallery();
  setItems(g, 'images', [
    { type: 'image', url: 'https://cdn/a.jpg' },
    { type: 'image', url: 'https://cdn/a.jpg' },
    { type: 'image', url: 'https://cdn/b.jpg' }
  ]);
  const result = g.getCurrentItems();
  assert.equal(result.length, 2);
});

test('getCurrentItems: empty input returns []', () => {
  const g = loadGallery();
  setItems(g, 'images', []);
  assert.equal(g.getCurrentItems().length, 0);
});

// ---------- grouping by postShortcode ----------

test('getCurrentItems: items sharing a shortcode collapse into one cover', () => {
  const g = loadGallery();
  setItems(g, 'images', [
    { type: 'image', url: 'https://cdn/1.jpg', postShortcode: 'Calbum', carouselIndex: 0, carouselSize: 3 },
    { type: 'image', url: 'https://cdn/2.jpg', postShortcode: 'Calbum', carouselIndex: 1, carouselSize: 3 },
    { type: 'image', url: 'https://cdn/3.jpg', postShortcode: 'Calbum', carouselIndex: 2, carouselSize: 3 }
  ]);
  const result = g.getCurrentItems();
  assert.equal(result.length, 1, 'three slides → one cover');
  const cover = result[0];
  assert.equal(cover.carouselSize, 3);
  assert.ok(Array.isArray(cover._carouselSlides), '_carouselSlides should be present');
  assert.equal(cover._carouselSlides.length, 3);
});

test('getCurrentItems: cover is the lowest carouselIndex (slide 0)', () => {
  const g = loadGallery();
  // Insert in scrambled order to verify sort
  setItems(g, 'images', [
    { type: 'image', url: 'https://cdn/2.jpg', postShortcode: 'C', carouselIndex: 1 },
    { type: 'image', url: 'https://cdn/3.jpg', postShortcode: 'C', carouselIndex: 2 },
    { type: 'image', url: 'https://cdn/1.jpg', postShortcode: 'C', carouselIndex: 0 }
  ]);
  const result = g.getCurrentItems();
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://cdn/1.jpg', 'cover should be slide 0');
  assert.equal(result[0]._carouselSlides[0].url, 'https://cdn/1.jpg');
  assert.equal(result[0]._carouselSlides[1].url, 'https://cdn/2.jpg');
  assert.equal(result[0]._carouselSlides[2].url, 'https://cdn/3.jpg');
});

test('getCurrentItems: single-slide post (carouselSize 1) does not get _carouselSlides', () => {
  const g = loadGallery();
  setItems(g, 'images', [
    { type: 'image', url: 'https://cdn/x.jpg', postShortcode: 'Calone', carouselIndex: 0, carouselSize: 1 }
  ]);
  const result = g.getCurrentItems();
  assert.equal(result.length, 1);
  assert.equal(result[0]._carouselSlides, undefined, 'single posts should not be wrapped');
});

test('getCurrentItems: capture order is preserved (first-occurrence wins)', () => {
  const g = loadGallery();
  // Mix posts: PostA item, PostB item, PostA item — display order should be A, B (not B before A)
  setItems(g, 'images', [
    { type: 'image', url: 'https://cdn/a1.jpg', postShortcode: 'PostA', carouselIndex: 0 },
    { type: 'image', url: 'https://cdn/b1.jpg', postShortcode: 'PostB', carouselIndex: 0 },
    { type: 'image', url: 'https://cdn/a2.jpg', postShortcode: 'PostA', carouselIndex: 1 }
  ]);
  const result = g.getCurrentItems();
  assert.equal(result.length, 2);
  assert.equal(result[0].postShortcode, 'PostA');
  assert.equal(result[1].postShortcode, 'PostB');
});

test('getCurrentItems: legacy items (no shortcode) interleave with grouped posts in capture order', () => {
  const g = loadGallery();
  setItems(g, 'images', [
    { type: 'image', url: 'https://cdn/legacy1.jpg' },
    { type: 'image', url: 'https://cdn/a1.jpg', postShortcode: 'PostA', carouselIndex: 0 },
    { type: 'image', url: 'https://cdn/legacy2.jpg' },
    { type: 'image', url: 'https://cdn/a2.jpg', postShortcode: 'PostA', carouselIndex: 1 }
  ]);
  const result = g.getCurrentItems();
  // Three display entries: legacy1, PostA-cover (grouped), legacy2
  assert.equal(result.length, 3);
  assert.equal(result[0].url, 'https://cdn/legacy1.jpg');
  assert.equal(result[1].postShortcode, 'PostA');
  assert.equal(result[1].carouselSize, 2);
  assert.equal(result[2].url, 'https://cdn/legacy2.jpg');
});

test('getCurrentItems: cover is a clone — mutating it does not corrupt the underlying slide', () => {
  const g = loadGallery();
  const slide0 = { type: 'image', url: 'https://cdn/1.jpg', postShortcode: 'C', carouselIndex: 0 };
  const slide1 = { type: 'image', url: 'https://cdn/2.jpg', postShortcode: 'C', carouselIndex: 1 };
  setItems(g, 'images', [slide0, slide1]);
  const cover = g.getCurrentItems()[0];
  assert.notEqual(cover, slide0, 'cover should be a clone, not the original slide');
  // The original slide should not have _carouselSlides spliced onto it
  assert.equal(slide0._carouselSlides, undefined);
});

test('getCurrentItems: switches between images and videos by currentTab', () => {
  const g = loadGallery();
  g.allMedia.images = [{ type: 'image', url: 'https://cdn/i.jpg' }];
  g.allMedia.videos = [{ type: 'video', url: 'https://cdn/v.mp4' }];

  g.currentTab = 'images';
  const imgs = g.getCurrentItems();
  assert.equal(imgs.length, 1);
  assert.equal(imgs[0].type, 'image');

  g.currentTab = 'videos';
  const vids = g.getCurrentItems();
  assert.equal(vids.length, 1);
  assert.equal(vids[0].type, 'video');
});

test('getCurrentItems: a video carousel groups too (videos tab)', () => {
  const g = loadGallery();
  g.allMedia.images = [];
  g.allMedia.videos = [
    { type: 'video', url: 'https://cdn/v1.mp4', postShortcode: 'Cvids', carouselIndex: 0 },
    { type: 'video', url: 'https://cdn/v2.mp4', postShortcode: 'Cvids', carouselIndex: 1 }
  ];
  g.currentTab = 'videos';
  const result = g.getCurrentItems();
  assert.equal(result.length, 1);
  assert.equal(result[0].carouselSize, 2);
});

// ---------- getFullscreenItems: flat list across all posts ----------
// Regression test for the bug where fullscreen Next looped within a single
// carousel instead of advancing to the next post.

test('getFullscreenItems: flattens carousels into individual slides in capture order', () => {
  const g = loadGallery();
  setItems(g, 'images', [
    // Single
    { type: 'image', url: 'https://cdn/single1.jpg' },
    // Carousel A: 3 slides
    { type: 'image', url: 'https://cdn/A1.jpg', postShortcode: 'PostA', carouselIndex: 0 },
    { type: 'image', url: 'https://cdn/A2.jpg', postShortcode: 'PostA', carouselIndex: 1 },
    { type: 'image', url: 'https://cdn/A3.jpg', postShortcode: 'PostA', carouselIndex: 2 },
    // Carousel B: 2 slides
    { type: 'image', url: 'https://cdn/B1.jpg', postShortcode: 'PostB', carouselIndex: 0 },
    { type: 'image', url: 'https://cdn/B2.jpg', postShortcode: 'PostB', carouselIndex: 1 }
  ]);

  const fs = g.getFullscreenItems();
  // 1 single + 3 A + 2 B = 6 entries
  assert.equal(fs.length, 6);
  // Order preserved: single, A1, A2, A3, B1, B2
  assert.equal(fs[0].url, 'https://cdn/single1.jpg');
  assert.equal(fs[1].url, 'https://cdn/A1.jpg');
  assert.equal(fs[2].url, 'https://cdn/A2.jpg');
  assert.equal(fs[3].url, 'https://cdn/A3.jpg');
  assert.equal(fs[4].url, 'https://cdn/B1.jpg');
  assert.equal(fs[5].url, 'https://cdn/B2.jpg');
});

test('getFullscreenItems: empty gallery returns []', () => {
  const g = loadGallery();
  setItems(g, 'images', []);
  assert.equal(g.getFullscreenItems().length, 0);
});

test('getFullscreenItems: gallery with no carousels matches getCurrentItems', () => {
  const g = loadGallery();
  setItems(g, 'images', [
    { type: 'image', url: 'https://cdn/a.jpg' },
    { type: 'image', url: 'https://cdn/b.jpg' },
    { type: 'image', url: 'https://cdn/c.jpg' }
  ]);
  const fs = g.getFullscreenItems();
  const cur = g.getCurrentItems();
  assert.equal(fs.length, cur.length);
  for (let i = 0; i < fs.length; i++) {
    assert.equal(fs[i].url, cur[i].url);
  }
});
