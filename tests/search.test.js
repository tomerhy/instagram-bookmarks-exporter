// Tests for the v4.3.9 gallery search filter.
//
// Search filters the current tab by substring against three fields on each
// grouped item: metadata.owner, metadata.caption, metadata.hashtags[].
// Token prefixes:
//   @user → match owner only
//   #tag  → match hashtags only
//   bare  → match across all three
// Multiple space-separated tokens are AND-ed.
//
// matchesQuery() is pure; that's the entire test surface.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTopLevel } = require('./_setup');

function loadGallery() {
  return loadTopLevel('gallery.js');
}

function item(meta) {
  return { type: 'image', url: 'x.jpg', metadata: meta || null };
}

// ---------- Empty queries ----------

test('matchesQuery: empty / whitespace query matches every item', () => {
  const g = loadGallery();
  const it = item({ owner: 'alice', caption: 'hi', hashtags: ['food'] });
  assert.equal(g.matchesQuery(it, ''), true);
  assert.equal(g.matchesQuery(it, '   '), true);
  assert.equal(g.matchesQuery(it, null), true);
  assert.equal(g.matchesQuery(it, undefined), true);
});

test('matchesQuery: items without metadata never match a non-empty query', () => {
  const g = loadGallery();
  assert.equal(g.matchesQuery({ type: 'image', url: 'x.jpg' }, 'anything'), false,
    'item without metadata must be filtered out when a query is active');
  assert.equal(g.matchesQuery(null, 'x'), false);
  assert.equal(g.matchesQuery(undefined, 'x'), false);
});

// ---------- Bare tokens — match across owner / caption / hashtags ----------

test('matchesQuery: bare token matches owner (substring)', () => {
  const g = loadGallery();
  const it = item({ owner: 'alice_dev', caption: null, hashtags: [] });
  assert.equal(g.matchesQuery(it, 'alice'), true);
  assert.equal(g.matchesQuery(it, '_dev'), true,
    'substring match, not just prefix');
});

test('matchesQuery: bare token matches caption (case-insensitive)', () => {
  const g = loadGallery();
  const it = item({ owner: null, caption: 'A Sunny Day in Tel Aviv', hashtags: [] });
  assert.equal(g.matchesQuery(it, 'sunny'), true,
    'caption match should be case-insensitive');
  assert.equal(g.matchesQuery(it, 'TEL'), true);
  assert.equal(g.matchesQuery(it, 'rain'), false);
});

test('matchesQuery: bare token matches hashtag (without the # prefix)', () => {
  const g = loadGallery();
  const it = item({ owner: null, caption: null, hashtags: ['travel', 'beach', 'sunset'] });
  assert.equal(g.matchesQuery(it, 'beach'), true);
  assert.equal(g.matchesQuery(it, 'sun'), true,
    'hashtag substring match');
  assert.equal(g.matchesQuery(it, 'food'), false);
});

test('matchesQuery: bare token spans all three fields (any hit wins)', () => {
  const g = loadGallery();
  const it = item({ owner: 'mark', caption: 'Best pasta', hashtags: ['italy'] });
  assert.equal(g.matchesQuery(it, 'mark'), true);
  assert.equal(g.matchesQuery(it, 'pasta'), true);
  assert.equal(g.matchesQuery(it, 'italy'), true);
});

// ---------- @user prefix — owner-only ----------

test('matchesQuery: @user matches ONLY owner (not caption or hashtags)', () => {
  const g = loadGallery();
  const ownerHit = item({ owner: 'foodlover', caption: null, hashtags: [] });
  assert.equal(g.matchesQuery(ownerHit, '@food'), true);

  const captionDecoy = item({ owner: 'alice', caption: 'I love food', hashtags: [] });
  assert.equal(g.matchesQuery(captionDecoy, '@food'), false,
    '@user must not leak into caption matches');

  const hashtagDecoy = item({ owner: 'alice', caption: null, hashtags: ['food'] });
  assert.equal(g.matchesQuery(hashtagDecoy, '@food'), false,
    '@user must not leak into hashtag matches');
});

test('matchesQuery: bare @ (no name) does not match anything', () => {
  const g = loadGallery();
  const it = item({ owner: 'alice', caption: null, hashtags: [] });
  assert.equal(g.matchesQuery(it, '@'), false);
});

// ---------- #tag prefix — hashtags-only ----------

test('matchesQuery: #tag matches ONLY hashtags (not owner or caption)', () => {
  const g = loadGallery();
  const tagHit = item({ owner: null, caption: null, hashtags: ['travel'] });
  assert.equal(g.matchesQuery(tagHit, '#travel'), true);

  const captionDecoy = item({ owner: null, caption: 'love to travel', hashtags: [] });
  assert.equal(g.matchesQuery(captionDecoy, '#travel'), false,
    '#tag must not leak into caption matches');

  const ownerDecoy = item({ owner: 'travel_guy', caption: null, hashtags: [] });
  assert.equal(g.matchesQuery(ownerDecoy, '#travel'), false,
    '#tag must not leak into owner matches');
});

test('matchesQuery: #tag matches as substring inside a longer hashtag', () => {
  const g = loadGallery();
  const it = item({ owner: null, caption: null, hashtags: ['foodporn', 'streetfood'] });
  assert.equal(g.matchesQuery(it, '#food'), true,
    'substring match on hashtags, like the other fields');
});

// ---------- Multi-token (AND) ----------

test('matchesQuery: multiple tokens are AND-ed (all must match somewhere)', () => {
  const g = loadGallery();
  const it = item({ owner: 'alice', caption: 'Beach day with friends', hashtags: ['summer'] });
  // alice matches owner; beach matches caption; summer matches hashtag
  assert.equal(g.matchesQuery(it, 'alice beach summer'), true);
  // alice matches; "winter" matches nothing → overall miss
  assert.equal(g.matchesQuery(it, 'alice winter'), false);
});

test('matchesQuery: mixed @ and # token modifiers AND-ed', () => {
  const g = loadGallery();
  const it = item({ owner: 'foodie', caption: 'Pasta', hashtags: ['italian'] });
  assert.equal(g.matchesQuery(it, '@food #italian'), true,
    'both owner and hashtag must hit');
  assert.equal(g.matchesQuery(it, '@food #spanish'), false,
    'one of the two missing should drop the result');
});

// ---------- Case sensitivity ----------

test('matchesQuery: queries normalized to lowercase before matching', () => {
  const g = loadGallery();
  const it = item({ owner: 'AliceDev', caption: 'TRAVEL', hashtags: ['Summer'] });
  assert.equal(g.matchesQuery(it, 'alice'), true);
  assert.equal(g.matchesQuery(it, 'travel'), true);
  assert.equal(g.matchesQuery(it, '#summer'), true);
  assert.equal(g.matchesQuery(it, '@ALICE'), true,
    'prefix tokens should also normalize');
});

// ---------- Defensive shapes ----------

test('matchesQuery: tolerates missing/null fields within metadata', () => {
  const g = loadGallery();
  const onlyCaption = item({ caption: 'hello world' });
  assert.equal(g.matchesQuery(onlyCaption, 'hello'), true);
  assert.equal(g.matchesQuery(onlyCaption, '@user'), false,
    '@user against a missing owner is a clean miss, not a throw');

  const onlyOwner = item({ owner: 'alice' });
  assert.equal(g.matchesQuery(onlyOwner, 'alice'), true);
  assert.equal(g.matchesQuery(onlyOwner, '#food'), false,
    '#tag against a missing hashtags array is a clean miss');
});

test('matchesQuery: hashtags array of non-strings does not crash', () => {
  const g = loadGallery();
  // Defensive: if upstream ever stores non-strings, we coerce.
  const weird = item({ owner: null, caption: null, hashtags: [42, null, 'real'] });
  assert.doesNotThrow(() => g.matchesQuery(weird, '#real'));
  assert.equal(g.matchesQuery(weird, '#real'), true);
});

// ---------- getFilteredItems integration ----------

test('getFilteredItems: returns the full grouped list when query is empty', () => {
  const g = loadGallery();
  g.allMedia.images = [
    { type: 'image', url: 'a.jpg', metadata: { owner: 'a' } },
    { type: 'image', url: 'b.jpg', metadata: { owner: 'b' } }
  ];
  g.currentTab = 'images';
  g.searchQuery = '';
  assert.equal(g.getFilteredItems().length, 2);
});

test('getFilteredItems: filters by the active searchQuery', () => {
  const g = loadGallery();
  g.allMedia.images = [
    { type: 'image', url: 'a.jpg', metadata: { owner: 'alice', caption: 'beach' } },
    { type: 'image', url: 'b.jpg', metadata: { owner: 'bob',   caption: 'forest' } },
    { type: 'image', url: 'c.jpg', metadata: { owner: 'alice', caption: 'forest' } }
  ];
  g.currentTab = 'images';
  g.searchQuery = 'alice';
  const result = g.getFilteredItems();
  assert.equal(result.length, 2, 'two items belong to alice');

  g.searchQuery = 'alice forest';
  assert.equal(g.getFilteredItems().length, 1, 'AND of alice + forest narrows to one');
});
