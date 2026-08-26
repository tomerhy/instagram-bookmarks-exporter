// Tests for the v4.4.0 CSV export.
//
// CSV exports the current tab as a flat table — one row per item — with
// columns covering URL, post, carousel index/size, and all of the v4.3
// metadata fields. The tricky part is escaping: caption text from Instagram
// regularly contains commas, quotes, newlines, and emoji. We follow
// RFC 4180: fields with comma / quote / CR / LF get wrapped in double
// quotes, and embedded quotes are escaped by doubling them.

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

// ---------- csvEscape ----------

test('csvEscape: plain strings pass through unquoted', () => {
  const g = loadGallery();
  assert.equal(g.csvEscape('hello'), 'hello');
  assert.equal(g.csvEscape('foo_bar'), 'foo_bar');
  assert.equal(g.csvEscape('alice123'), 'alice123');
});

test('csvEscape: null / undefined / "" → empty string (NOT "null")', () => {
  const g = loadGallery();
  assert.equal(g.csvEscape(null), '');
  assert.equal(g.csvEscape(undefined), '');
  assert.equal(g.csvEscape(''), '');
});

test('csvEscape: numbers stringify without quotes', () => {
  const g = loadGallery();
  assert.equal(g.csvEscape(42), '42');
  assert.equal(g.csvEscape(0), '0');
  assert.equal(g.csvEscape(3.14), '3.14');
});

test('csvEscape: comma triggers double-quote wrapping', () => {
  const g = loadGallery();
  assert.equal(g.csvEscape('hello, world'), '"hello, world"');
});

test('csvEscape: newlines (LF and CR) trigger wrapping — captions often span lines', () => {
  const g = loadGallery();
  assert.equal(g.csvEscape('line one\nline two'), '"line one\nline two"');
  assert.equal(g.csvEscape('windows\r\nstyle'), '"windows\r\nstyle"');
});

test('csvEscape: embedded double quotes get doubled inside a wrapped field', () => {
  const g = loadGallery();
  assert.equal(g.csvEscape('she said "hi"'), '"she said ""hi"""');
});

test('csvEscape: comma + quote together — both quoting rules apply', () => {
  const g = loadGallery();
  assert.equal(g.csvEscape('a, "b", c'), '"a, ""b"", c"');
});

test('csvEscape: emoji and non-ASCII pass through unchanged (no wrapping needed)', () => {
  const g = loadGallery();
  assert.equal(g.csvEscape('hello 👋 world'), 'hello 👋 world');
  assert.equal(g.csvEscape('café'), 'café');
});

// ---------- buildCsv ----------

test('buildCsv: empty list produces just the header row', () => {
  const g = loadGallery();
  const csv = g.buildCsv([]);
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 1, 'header only');
  assert.match(lines[0], /^type,url,thumbnail/);
});

test('buildCsv: header lists all expected columns in stable order', () => {
  const g = loadGallery();
  const csv = g.buildCsv([]);
  // Column order is part of the contract for users who script around this.
  assert.equal(
    csv.split('\r\n')[0],
    'type,url,thumbnail,postUrl,postShortcode,carouselIndex,carouselSize,owner,caption,takenAt,likeCount,hashtags,scrapedAt'
  );
});

test('buildCsv: one row per item with all fields populated', () => {
  const g = loadGallery();
  const item = {
    type: 'image',
    url: 'https://scontent.cdninstagram.com/x.jpg',
    thumbnail: 'https://scontent.cdninstagram.com/x_t.jpg',
    postUrl: 'https://instagram.com/p/ABC',
    postShortcode: 'ABC',
    carouselIndex: 2,
    carouselSize: 5,
    scrapedAt: '2026-05-22T10:00:00.000Z',
    metadata: {
      owner: 'photog',
      caption: 'A sunny day',
      takenAt: '2026-05-20T09:00:00.000Z',
      likeCount: 1234,
      hashtags: ['travel', 'beach']
    }
  };
  const csv = g.buildCsv([item]);
  const dataRow = csv.split('\r\n')[1];
  // Expected: hashtags joined by space, numbers as-is, dates as ISO strings.
  assert.equal(
    dataRow,
    'image,https://scontent.cdninstagram.com/x.jpg,https://scontent.cdninstagram.com/x_t.jpg,https://instagram.com/p/ABC,ABC,2,5,photog,A sunny day,2026-05-20T09:00:00.000Z,1234,travel beach,2026-05-22T10:00:00.000Z'
  );
});

test('buildCsv: items with no metadata leave the metadata columns empty', () => {
  const g = loadGallery();
  const item = { type: 'image', url: 'https://scontent.cdninstagram.com/x.jpg' };
  const csv = g.buildCsv([item]);
  const dataRow = csv.split('\r\n')[1];
  // type,url,(thumbnail),(postUrl),(postShortcode),(carouselIndex),(carouselSize),(owner),(caption),(takenAt),(likeCount),(hashtags),(scrapedAt)
  assert.equal(dataRow, 'image,https://scontent.cdninstagram.com/x.jpg,,,,,,,,,,,');
});

test('buildCsv: caption with commas is wrapped in quotes (the original CSV escape bug)', () => {
  const g = loadGallery();
  const item = {
    type: 'image',
    url: 'https://scontent.cdninstagram.com/x.jpg',
    metadata: { caption: 'apples, oranges, and bananas' }
  };
  const csv = g.buildCsv([item]);
  // Spot-check that the caption column is quoted in the right place.
  assert.match(csv, /"apples, oranges, and bananas"/);
});

test('buildCsv: caption with embedded newlines stays inside one CSV record', () => {
  const g = loadGallery();
  const item = {
    type: 'image',
    url: 'https://scontent.cdninstagram.com/x.jpg',
    metadata: { caption: 'line one\nline two\nline three' }
  };
  const csv = g.buildCsv([item]);
  // The whole CSV should still be exactly two records (header + 1 data line),
  // even though the caption has internal newlines — because they're inside
  // a quoted field.
  // We can't naively split on \r\n; check by parsing back.
  // Simpler assertion: the caption text appears intact in a quoted field.
  assert.match(csv, /"line one\nline two\nline three"/);
});

test('buildCsv: caption with embedded double quotes gets each quote doubled', () => {
  const g = loadGallery();
  const item = {
    type: 'image',
    url: 'https://scontent.cdninstagram.com/x.jpg',
    metadata: { caption: 'she said "hi" then left' }
  };
  const csv = g.buildCsv([item]);
  assert.match(csv, /"she said ""hi"" then left"/);
});

test('buildCsv: non-numeric likeCount drops to empty (not "null", not "NaN")', () => {
  const g = loadGallery();
  const a = { type: 'image', url: 'https://scontent.cdninstagram.com/a.jpg', metadata: { likeCount: 42 } };
  const b = { type: 'image', url: 'https://scontent.cdninstagram.com/b.jpg', metadata: { likeCount: '50' } }; // string
  const c = { type: 'image', url: 'https://scontent.cdninstagram.com/c.jpg', metadata: { likeCount: null } };
  const csv = g.buildCsv([a, b, c]);
  const lines = csv.split('\r\n');
  // likeCount is the 11th column (index 10).
  assert.equal(lines[1].split(',')[10], '42');
  assert.equal(lines[2].split(',')[10], '', 'string likeCount → empty cell');
  assert.equal(lines[3].split(',')[10], '', 'null likeCount → empty cell');
});

test('buildCsv: hashtags array becomes a space-separated string', () => {
  const g = loadGallery();
  const item = {
    type: 'image',
    url: 'https://scontent.cdninstagram.com/x.jpg',
    metadata: { hashtags: ['travel', 'beach', 'sunset'] }
  };
  const csv = g.buildCsv([item]);
  assert.match(csv, /travel beach sunset/);
});

test('buildCsv: lines are joined with CRLF (RFC 4180 mandates it)', () => {
  const g = loadGallery();
  const items = [
    { type: 'image', url: 'https://scontent.cdninstagram.com/a.jpg' },
    { type: 'image', url: 'https://scontent.cdninstagram.com/b.jpg' }
  ];
  const csv = g.buildCsv(items);
  // Header + 2 rows = 3 segments, joined by exactly 2 CRLFs.
  assert.equal(csv.split('\r\n').length, 3);
  assert.ok(csv.includes('\r\n'), 'CRLF should be the line separator');
});

test('buildCsv: non-array input returns just the header (defensive)', () => {
  const g = loadGallery();
  assert.equal(g.buildCsv(null).split('\r\n').length, 1);
  assert.equal(g.buildCsv(undefined).split('\r\n').length, 1);
});
