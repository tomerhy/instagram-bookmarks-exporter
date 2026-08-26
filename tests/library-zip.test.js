// Tests for the v4.4.0 "Download all (zip)" feature — item 19.
//
// Whole-library zip with per-owner folders. The driver
// (downloadLibrary) is integration territory: it fetches every slide,
// streams into JSZip, and triggers a download. We test the pure helpers
// that decide:
//   - which folder each item lands in (owner grouping + sanitization)
//   - what filename it gets inside that folder (single vs album)
//   - what the top-level manifest.json says about the batch

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

function img(owner, shortcode, extra) {
  return Object.assign(
    { type: 'image', url: 'https://scontent.cdninstagram.com/' + (shortcode || 'x') + '.jpg' },
    extra || {},
    {
      postShortcode: shortcode || null,
      metadata: owner ? Object.assign({ owner: owner }, (extra && extra.metadata) || {}) : null
    }
  );
}

// Cross-realm safe deep compare.
function deepEq(actual, expected, msg) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(actual)),
    JSON.parse(JSON.stringify(expected)),
    msg
  );
}

// ---------- _safeFolderName ----------

test('_safeFolderName: keeps allowed chars, replaces the rest with underscore', () => {
  const g = loadGallery();
  assert.equal(g._safeFolderName('alice'), 'alice');
  assert.equal(g._safeFolderName('alice.dev'), 'alice.dev');
  assert.equal(g._safeFolderName('alice_dev-123'), 'alice_dev-123');
  assert.equal(g._safeFolderName('alice@dev'), 'alice_dev');
  assert.equal(g._safeFolderName('alice/dev'), 'alice_dev');
  // The 👋 emoji is a JavaScript surrogate pair (two code units), so the
  // regex matches each half — two _ for the emoji + one each for the
  // surrounding spaces = four underscores. Multi-byte char weirdness, but
  // the OUTCOME is still safe: alphanumerics survive, everything else is _.
  assert.equal(g._safeFolderName('hi 👋 world'), 'hi____world',
    'emoji can be multiple JS code units — sanitized to _ each');
});

test('_safeFolderName: empty / null / undefined → "_unknown" (never empty)', () => {
  const g = loadGallery();
  assert.equal(g._safeFolderName(''), '_unknown');
  assert.equal(g._safeFolderName(null), '_unknown');
  assert.equal(g._safeFolderName(undefined), '_unknown');
});

test('_safeFolderName: an all-punctuation name collapses to "_unknown" not just "____"', () => {
  const g = loadGallery();
  // All slashes / colons / spaces → "____" but logically meaningless.
  // We treat that as "no real name" → _unknown.
  assert.equal(g._safeFolderName('////'), '_unknown',
    'a folder name of just underscores is functionally nameless — collapse to _unknown');
});

// ---------- _ownerKey ----------

test('_ownerKey: pulls metadata.owner when present', () => {
  const g = loadGallery();
  assert.equal(g._ownerKey({ metadata: { owner: 'alice' } }), 'alice');
});

test('_ownerKey: returns "_unknown" for items without owner metadata', () => {
  const g = loadGallery();
  assert.equal(g._ownerKey({}), '_unknown');
  assert.equal(g._ownerKey({ metadata: {} }), '_unknown');
  assert.equal(g._ownerKey({ metadata: { owner: null } }), '_unknown');
  assert.equal(g._ownerKey(null), '_unknown');
});

// ---------- groupItemsByOwner ----------

test('groupItemsByOwner: groups by owner, preserves first-seen order', () => {
  const g = loadGallery();
  const items = [
    img('alice', 'A'),
    img('bob',   'B'),
    img('alice', 'C'),
    img('alice', 'D'),
    img('bob',   'E')
  ];
  const groups = g.groupItemsByOwner(items);
  assert.equal(groups.length, 2, 'two unique owners');
  assert.equal(groups[0][0], 'alice', 'alice appears first (seen first)');
  assert.equal(groups[0][1].length, 3, 'alice has 3 items');
  assert.equal(groups[1][0], 'bob');
  assert.equal(groups[1][1].length, 2);
});

test('groupItemsByOwner: items within a group keep input order (stable)', () => {
  const g = loadGallery();
  const items = [
    img('alice', 'A'),
    img('alice', 'B'),
    img('alice', 'C')
  ];
  const groups = g.groupItemsByOwner(items);
  deepEq(
    groups[0][1].map(i => i.postShortcode),
    ['A', 'B', 'C'],
    'order inside the group matches input — sorted input stays sorted'
  );
});

test('groupItemsByOwner: items without owner collected under "_unknown"', () => {
  const g = loadGallery();
  const items = [
    img('alice', 'A'),
    img(null,    'B'),
    img(null,    'C'),
    img('alice', 'D')
  ];
  const groups = g.groupItemsByOwner(items);
  const ownerKeys = groups.map(g => g[0]);
  assert.ok(ownerKeys.includes('_unknown'),
    '_unknown is a real group when items lack owner metadata');
  const unknown = groups.find(g => g[0] === '_unknown');
  assert.equal(unknown[1].length, 2, 'B and C land in _unknown together');
});

test('groupItemsByOwner: empty / non-array input → []', () => {
  const g = loadGallery();
  assert.equal(g.groupItemsByOwner([]).length, 0);
  assert.equal(g.groupItemsByOwner(null).length, 0);
  assert.equal(g.groupItemsByOwner(undefined).length, 0);
});

// ---------- _itemPathInOwnerFolder ----------

test('_itemPathInOwnerFolder: single-slide item → flat <shortcode>.<ext>', () => {
  const g = loadGallery();
  const item = { postShortcode: 'ABC', type: 'image' };
  assert.equal(g._itemPathInOwnerFolder(item, item, 0, 1, 0), 'ABC.jpg');
});

test('_itemPathInOwnerFolder: album → <shortcode>/NN.<ext>, zero-padded', () => {
  const g = loadGallery();
  const item = { postShortcode: 'XYZ' };
  // 3-slide album
  assert.equal(g._itemPathInOwnerFolder(item, { type: 'image' }, 0, 3, 0), 'XYZ/1.jpg');
  assert.equal(g._itemPathInOwnerFolder(item, { type: 'image' }, 2, 3, 0), 'XYZ/3.jpg');
  // 12-slide album → 2-digit padding
  assert.equal(g._itemPathInOwnerFolder(item, { type: 'image' }, 0, 12, 0), 'XYZ/01.jpg');
  assert.equal(g._itemPathInOwnerFolder(item, { type: 'image' }, 11, 12, 0), 'XYZ/12.jpg');
});

test('_itemPathInOwnerFolder: extension follows the slide, not the parent (mixed media albums)', () => {
  const g = loadGallery();
  const item = { postShortcode: 'XYZ' };
  assert.equal(
    g._itemPathInOwnerFolder(item, { url: 'https://scontent.cdninstagram.com/a.mp4', type: 'video' }, 0, 2, 0),
    'XYZ/1.mp4',
    'video slide inside a mixed album keeps its mp4 extension'
  );
});

test('_itemPathInOwnerFolder: missing shortcode → item_NNNN fallback (never nameless)', () => {
  const g = loadGallery();
  const item = { type: 'image' };
  assert.equal(g._itemPathInOwnerFolder(item, item, 0, 1, 0), 'item_0001.jpg');
  assert.equal(g._itemPathInOwnerFolder(item, item, 0, 1, 41), 'item_0042.jpg',
    '1-based and zero-padded so paginated batches stay sortable');
});

test('_itemPathInOwnerFolder: unsafe characters in shortcode sanitized', () => {
  const g = loadGallery();
  const item = { postShortcode: 'A/B?C', type: 'image' };
  assert.equal(g._itemPathInOwnerFolder(item, item, 0, 1, 0), 'A_B_C.jpg');
});

// ---------- buildLibraryManifest ----------

test('buildLibraryManifest: empty input → valid empty manifest', () => {
  const g = loadGallery();
  const m = g.buildLibraryManifest([], []);
  assert.equal(m.format, 'saved-posts-backup-export-library');
  assert.equal(m.formatVersion, 1);
  assert.equal(m.totalItems, 0);
  assert.equal(m.totalOwners, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(m.owners)), []);
});

test('buildLibraryManifest: maps groups to owners[] with item counts + per-item metadata', () => {
  const g = loadGallery();
  const items = [
    img('alice', 'A', { metadata: { owner: 'alice', caption: 'cap A', likeCount: 100 } }),
    img('alice', 'B'),
    img('bob',   'C')
  ];
  const groups = g.groupItemsByOwner(items);
  const m = g.buildLibraryManifest(items, groups, '4.4.0');

  assert.equal(m.extensionVersion, '4.4.0');
  assert.equal(m.totalItems, 3);
  assert.equal(m.totalOwners, 2);

  const aliceGroup = m.owners.find(o => o.owner === 'alice');
  assert.equal(aliceGroup.folder, 'alice');
  assert.equal(aliceGroup.itemCount, 2);
  assert.equal(aliceGroup.items[0].shortcode, 'A');
  assert.equal(aliceGroup.items[0].caption, 'cap A');
  assert.equal(aliceGroup.items[0].likeCount, 100);
});

test('buildLibraryManifest: "_unknown" group writes owner=null but keeps a folder name', () => {
  const g = loadGallery();
  const items = [img(null, 'X')];
  const groups = g.groupItemsByOwner(items);
  const m = g.buildLibraryManifest(items, groups);
  const unknown = m.owners[0];
  assert.equal(unknown.owner, null, 'manifest reports null owner');
  assert.equal(unknown.folder, '_unknown', 'folder name still _unknown');
});

test('buildLibraryManifest: album items carry slideCount, single items get 1', () => {
  const g = loadGallery();
  const album = img('alice', 'ALB', {});
  album._carouselSlides = [{}, {}, {}];  // 3 slides
  const single = img('alice', 'ONE');
  const groups = g.groupItemsByOwner([album, single]);
  const m = g.buildLibraryManifest([album, single], groups);
  const alice = m.owners[0];
  assert.equal(alice.items[0].slideCount, 3, 'album slideCount comes from _carouselSlides');
  assert.equal(alice.items[1].slideCount, 1, 'single-slide items default to 1');
});

test('buildLibraryManifest: non-numeric likeCount drops to null', () => {
  const g = loadGallery();
  const items = [img('alice', 'X', { metadata: { owner: 'alice', likeCount: '500' } })];
  const m = g.buildLibraryManifest(items, g.groupItemsByOwner(items));
  assert.equal(m.owners[0].items[0].likeCount, null);
});

test('buildLibraryManifest: is JSON-serializable (no cycles, captions with quotes)', () => {
  const g = loadGallery();
  const items = [img('alice', 'X', { metadata: { owner: 'alice', caption: 'with "quotes" and, commas' } })];
  const m = g.buildLibraryManifest(items, g.groupItemsByOwner(items));
  assert.doesNotThrow(() => JSON.stringify(m));
  const round = JSON.parse(JSON.stringify(m));
  assert.equal(round.owners[0].items[0].caption, 'with "quotes" and, commas');
});

test('buildLibraryManifest: exportedAt is a valid ISO timestamp', () => {
  const g = loadGallery();
  const m = g.buildLibraryManifest([], []);
  assert.ok(m.exportedAt && !isNaN(new Date(m.exportedAt).getTime()));
});
