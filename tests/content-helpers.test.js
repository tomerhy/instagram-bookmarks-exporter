// Tests for the pure helpers in content.js: hashtag extraction, context →
// options translation, and the URL normalization that backs deduplication.
//
// normalizeUrl is the single most important invariant in CLAUDE.md
// ("must run new URLs through normalizeUrl before adding to seenUrls"); these
// tests pin its behavior so refactors don't silently break dedup.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadIIFE } = require('./_setup');

const { exposed: content } = loadIIFE('content.js');
const { extractHashtags, contextToOptions, normalizeUrl } = content;

// ---------- extractHashtags ----------

test('extractHashtags: basic ASCII tags', () => {
  const tags = extractHashtags('hello #world this is #great');
  assert.equal(tags.length, 2);
  assert.equal(tags[0], 'world');
  assert.equal(tags[1], 'great');
});

test('extractHashtags: unicode tags (Hebrew, Japanese, emoji-adjacent)', () => {
  const tags = extractHashtags('שלום #עולם 日本 #猫 cool');
  assert.ok(tags.includes('עולם'), 'should pick up Hebrew tag');
  assert.ok(tags.includes('猫'), 'should pick up Japanese tag');
});

test('extractHashtags: numeric and underscore tags', () => {
  const tags = extractHashtags('go #2026 #cool_stuff');
  assert.ok(tags.includes('2026'));
  assert.ok(tags.includes('cool_stuff'));
});

test('extractHashtags: empty / null / non-string returns []', () => {
  assert.equal(extractHashtags(null).length, 0);
  assert.equal(extractHashtags('').length, 0);
  assert.equal(extractHashtags(42).length, 0);
  assert.equal(extractHashtags({}).length, 0);
});

test('extractHashtags: bare # without word does not produce empty tag', () => {
  assert.equal(extractHashtags('hash # alone').length, 0);
});

// ---------- contextToOptions ----------

test('contextToOptions: null context → null', () => {
  assert.equal(contextToOptions(null), null);
  assert.equal(contextToOptions(undefined), null);
});

test('contextToOptions: full wire-format context translates cleanly', () => {
  const opts = contextToOptions({
    postShortcode: 'Cabc',
    carouselIndex: 2,
    carouselSize: 5,
    caption: 'cool #post',
    owner: 'someone',
    takenAt: '2024-06-01T00:00:00.000Z',
    likeCount: 12
  });
  assert.equal(opts.postShortcode, 'Cabc');
  assert.equal(opts.carouselIndex, 2);
  assert.equal(opts.carouselSize, 5);
  assert.equal(opts.metadata.caption, 'cool #post');
  assert.equal(opts.metadata.owner, 'someone');
  assert.equal(opts.metadata.takenAt, '2024-06-01T00:00:00.000Z');
  assert.equal(opts.metadata.likeCount, 12);
  assert.ok(opts.metadata.hashtags.includes('post'));
});

test('contextToOptions: missing carouselIndex stays null (not 0)', () => {
  const opts = contextToOptions({ postShortcode: 'C', carouselIndex: null, carouselSize: 1 });
  assert.equal(opts.carouselIndex, null);
});

test('contextToOptions: missing carouselSize defaults to 1', () => {
  const opts = contextToOptions({ postShortcode: 'C' });
  assert.equal(opts.carouselSize, 1);
});

test('contextToOptions: zero likeCount preserved (truthy-coerce trap)', () => {
  const opts = contextToOptions({ postShortcode: 'C', likeCount: 0 });
  assert.equal(opts.metadata.likeCount, 0);
});

// ---------- normalizeUrl (the dedup invariant) ----------

test('normalizeUrl: same path + cache key → same normalized form', () => {
  const a = 'https://scontent.cdninstagram.com/v/t51.29350-15/abc.jpg?stp=dst-jpg&_nc_ht=foo&ig_cache_key=KEY1';
  const b = 'https://scontent.cdninstagram.com/v/t51.29350-15/abc.jpg?stp=dst-jpg&_nc_ht=different&ig_cache_key=KEY1';
  // Different signing params, same logical resource → must dedup
  assert.equal(normalizeUrl(a), normalizeUrl(b));
});

test('normalizeUrl: different ig_cache_key → different normalized form', () => {
  const a = 'https://cdn/x.jpg?ig_cache_key=A&stp=p';
  const b = 'https://cdn/x.jpg?ig_cache_key=B&stp=p';
  assert.notEqual(normalizeUrl(a), normalizeUrl(b));
});

test('normalizeUrl: different stp → different normalized form', () => {
  // stp is a transform descriptor — different transforms = different rendered output
  const a = 'https://cdn/x.jpg?stp=p640x640&ig_cache_key=K';
  const b = 'https://cdn/x.jpg?stp=p1080x1080&ig_cache_key=K';
  assert.notEqual(normalizeUrl(a), normalizeUrl(b));
});

test('normalizeUrl: missing ig_cache_key + stp still normalizes consistently', () => {
  const a = 'https://cdn/x.jpg?_nc_ht=a';
  const b = 'https://cdn/x.jpg?_nc_ht=b';
  assert.equal(normalizeUrl(a), normalizeUrl(b));
});

test('normalizeUrl: malformed URL falls back to raw value (no throw)', () => {
  assert.doesNotThrow(() => normalizeUrl('not://a valid url at all'));
});

test('normalizeUrl: null / undefined returns null', () => {
  assert.equal(normalizeUrl(null), null);
  assert.equal(normalizeUrl(undefined), null);
});
