// Tests for the v4.4.0 gallery sort.
//
// Drop-down next to the search box. Sort keys:
//   default   — preserve capture order (no-op)
//   date_desc — metadata.takenAt newest → oldest
//   date_asc  — metadata.takenAt oldest → newest
//   owner     — metadata.owner alphabetical (case-insensitive)
//   likes     — metadata.likeCount high → low
//
// Items lacking the sort field always go to the BOTTOM regardless of
// direction, so a single bad item doesn't poison the top of the list.
// applySort() is pure; that's the entire test surface.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTopLevel, loadGallery: sharedLoadGallery } = require('./_setup');

// Uses the shared loader so url-allowlist.js and library-sanitize.js are
// evaluated first, exactly as gallery.html declares them. Without them
// SBE_URL is absent, every URL fails closed, and these tests would be
// measuring the fail-closed path instead of their actual subject.
function loadGallery() {
  return sharedLoadGallery();
}

function img(meta, idx) {
  return { type: 'image', url: 'u' + idx + '.jpg', metadata: meta || null, _idx: idx };
}

// ---------- default / no-op ----------

test('applySort: default key returns the input order untouched', () => {
  const g = loadGallery();
  const items = [img({ owner: 'a' }, 0), img({ owner: 'b' }, 1), img({ owner: 'c' }, 2)];
  const out = g.applySort(items, 'default');
  assert.equal(out.length, 3);
  assert.equal(out[0]._idx, 0);
  assert.equal(out[1]._idx, 1);
  assert.equal(out[2]._idx, 2);
});

test('applySort: unknown key behaves like default', () => {
  const g = loadGallery();
  const items = [img({ owner: 'a' }, 0), img({ owner: 'b' }, 1)];
  const out = g.applySort(items, 'banana');
  assert.equal(out[0]._idx, 0);
  assert.equal(out[1]._idx, 1);
});

test('applySort: empty / non-array input returns unchanged', () => {
  const g = loadGallery();
  assert.deepEqual(g.applySort([], 'date_desc'), []);
  assert.equal(g.applySort(null, 'date_desc'), null);
  assert.equal(g.applySort(undefined, 'date_desc'), undefined);
});

// ---------- date sort ----------

test('applySort: date_desc puts newest first', () => {
  const g = loadGallery();
  const items = [
    img({ takenAt: '2026-01-01T00:00:00Z' }, 0),  // oldest
    img({ takenAt: '2026-05-01T00:00:00Z' }, 1),  // middle
    img({ takenAt: '2026-09-01T00:00:00Z' }, 2),  // newest
  ];
  const out = g.applySort(items, 'date_desc');
  assert.equal(out[0]._idx, 2, 'newest first');
  assert.equal(out[1]._idx, 1);
  assert.equal(out[2]._idx, 0);
});

test('applySort: date_asc puts oldest first', () => {
  const g = loadGallery();
  const items = [
    img({ takenAt: '2026-09-01T00:00:00Z' }, 0),
    img({ takenAt: '2026-01-01T00:00:00Z' }, 1),
    img({ takenAt: '2026-05-01T00:00:00Z' }, 2),
  ];
  const out = g.applySort(items, 'date_asc');
  assert.equal(out[0]._idx, 1, 'oldest first');
  assert.equal(out[2]._idx, 0, 'newest last');
});

test('applySort: items without takenAt sink to bottom regardless of direction', () => {
  const g = loadGallery();
  const items = [
    img(null, 0),                                  // no metadata
    img({ takenAt: '2026-01-01T00:00:00Z' }, 1),
    img({ takenAt: null }, 2),                     // explicit null
    img({ takenAt: '2026-09-01T00:00:00Z' }, 3),
  ];
  const desc = g.applySort(items, 'date_desc');
  assert.equal(desc[0]._idx, 3, 'newest first');
  assert.equal(desc[1]._idx, 1);
  // 0 and 2 (both missing takenAt) at the bottom, original order preserved
  assert.deepEqual([desc[2]._idx, desc[3]._idx], [0, 2]);

  const asc = g.applySort(items, 'date_asc');
  assert.equal(asc[0]._idx, 1, 'oldest first');
  assert.equal(asc[1]._idx, 3);
  assert.deepEqual([asc[2]._idx, asc[3]._idx], [0, 2], 'missing still at bottom in asc too');
});

test('applySort: malformed takenAt strings count as missing', () => {
  const g = loadGallery();
  const items = [
    img({ takenAt: 'not a date' }, 0),
    img({ takenAt: '2026-01-01T00:00:00Z' }, 1),
  ];
  const out = g.applySort(items, 'date_desc');
  assert.equal(out[0]._idx, 1, 'valid date wins');
  assert.equal(out[1]._idx, 0, 'invalid sinks');
});

// ---------- owner sort ----------

test('applySort: owner sorts alphabetically, case-insensitive', () => {
  const g = loadGallery();
  const items = [
    img({ owner: 'Charlie' }, 0),
    img({ owner: 'alice' }, 1),
    img({ owner: 'Bob' }, 2),
  ];
  const out = g.applySort(items, 'owner');
  assert.equal(out[0]._idx, 1, 'alice first');
  assert.equal(out[1]._idx, 2, 'Bob second');
  assert.equal(out[2]._idx, 0, 'Charlie third');
});

test('applySort: missing owner sinks to bottom', () => {
  const g = loadGallery();
  const items = [
    img({ owner: 'zelda' }, 0),
    img({}, 1),                  // no owner
    img({ owner: 'alice' }, 2),
  ];
  const out = g.applySort(items, 'owner');
  assert.equal(out[0]._idx, 2);
  assert.equal(out[1]._idx, 0);
  assert.equal(out[2]._idx, 1, 'no-owner item at bottom');
});

// ---------- likes sort ----------

test('applySort: likes sorts high to low', () => {
  const g = loadGallery();
  const items = [
    img({ likeCount: 10 }, 0),
    img({ likeCount: 500 }, 1),
    img({ likeCount: 42 }, 2),
  ];
  const out = g.applySort(items, 'likes');
  assert.equal(out[0]._idx, 1);
  assert.equal(out[1]._idx, 2);
  assert.equal(out[2]._idx, 0);
});

test('applySort: missing/non-numeric likeCount sinks to bottom', () => {
  const g = loadGallery();
  const items = [
    img({ likeCount: 5 }, 0),
    img({ likeCount: '100' }, 1),  // string — counts as missing
    img({ likeCount: null }, 2),
    img({ likeCount: 50 }, 3),
  ];
  const out = g.applySort(items, 'likes');
  assert.equal(out[0]._idx, 3);
  assert.equal(out[1]._idx, 0);
  // 1 and 2 at the bottom (in original capture order)
  assert.deepEqual([out[2]._idx, out[3]._idx], [1, 2]);
});

test('applySort: zero likes is a valid value, not "missing"', () => {
  const g = loadGallery();
  const items = [
    img({ likeCount: 0 }, 0),
    img(null, 1),                  // truly missing
    img({ likeCount: 5 }, 2),
  ];
  const out = g.applySort(items, 'likes');
  assert.equal(out[0]._idx, 2, '5 likes wins');
  assert.equal(out[1]._idx, 0, '0 likes is still ranked, not dropped to bottom');
  assert.equal(out[2]._idx, 1, 'missing metadata at the bottom');
});

// ---------- stability ----------

test('applySort: equal keys preserve original capture order (stable sort)', () => {
  const g = loadGallery();
  const items = [
    img({ owner: 'alice' }, 0),
    img({ owner: 'alice' }, 1),
    img({ owner: 'alice' }, 2),
  ];
  const out = g.applySort(items, 'owner');
  assert.equal(out[0]._idx, 0);
  assert.equal(out[1]._idx, 1);
  assert.equal(out[2]._idx, 2);
});

test('applySort: does not mutate the input array', () => {
  const g = loadGallery();
  const items = [img({ likeCount: 1 }, 0), img({ likeCount: 9 }, 1)];
  const original = items.slice();
  g.applySort(items, 'likes');
  assert.equal(items[0]._idx, original[0]._idx);
  assert.equal(items[1]._idx, original[1]._idx);
});

// ---------- getFilteredItems integration ----------

test('getFilteredItems: applies sort after the search filter', () => {
  const g = loadGallery();
  g.allMedia.images = [
    { type: 'image', url: 'https://scontent.cdninstagram.com/a.jpg', metadata: { owner: 'alice', likeCount: 50 } },
    { type: 'image', url: 'https://scontent.cdninstagram.com/b.jpg', metadata: { owner: 'bob',   likeCount: 1000 } },
    { type: 'image', url: 'https://scontent.cdninstagram.com/c.jpg', metadata: { owner: 'alice', likeCount: 200 } },
  ];
  g.currentTab = 'images';
  g.searchQuery = 'alice';
  g.sortBy = 'likes';

  const result = g.getFilteredItems();
  assert.equal(result.length, 2, 'search filters to two alice items');
  assert.equal(result[0].url, 'https://scontent.cdninstagram.com/c.jpg', '200 likes ranks first');
  assert.equal(result[1].url, 'https://scontent.cdninstagram.com/a.jpg', '50 likes ranks second');
});
