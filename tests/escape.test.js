// Tests for escapeHtml in gallery.js. This is the only thing standing between
// a malicious caption and an XSS in the gallery DOM (renderViewerMeta and the
// owner overlay both inject metadata via innerHTML). Pin all five
// HTML-significant chars and verify there are no second-order escape bugs.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTopLevel, loadGallery: sharedLoadGallery } = require('./_setup');

const g = sharedLoadGallery();
const { escapeHtml } = g;

test('escapeHtml: basic safe input passes through', () => {
  assert.equal(escapeHtml('hello world'), 'hello world');
});

test('escapeHtml: escapes < and >', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('escapeHtml: escapes ampersand', () => {
  assert.equal(escapeHtml('Cats & Dogs'), 'Cats &amp; Dogs');
});

test('escapeHtml: escapes double and single quotes', () => {
  assert.equal(escapeHtml('he said "hi" and \'bye\''),
    'he said &quot;hi&quot; and &#39;bye&#39;');
});

test('escapeHtml: ampersand is escaped first (no double-encoding)', () => {
  // If & is replaced after the entity-prefixed chars, we'd get e.g. &amp;lt;
  // Verify the order: & → &amp; runs first, then < and > on raw input.
  assert.equal(escapeHtml('<&>'), '&lt;&amp;&gt;');
});

test('escapeHtml: handles already-encoded entity-looking input correctly', () => {
  // Input that already looks like an entity should still get its & escaped.
  assert.equal(escapeHtml('&amp;'), '&amp;amp;');
});

test('escapeHtml: null and undefined become empty string', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('escapeHtml: numbers and booleans stringify', () => {
  assert.equal(escapeHtml(42), '42');
  assert.equal(escapeHtml(true), 'true');
});

test('escapeHtml: realistic XSS payload is neutralized', () => {
  const payload = '"><img src=x onerror=alert(1)>';
  const out = escapeHtml(payload);
  assert.ok(!out.includes('<img'), 'must not leave an unescaped <img');
  assert.ok(!out.includes('"'), 'must not leave a raw double-quote');
  assert.equal(out, '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
});

test('escapeHtml: unicode characters pass through unmodified', () => {
  assert.equal(escapeHtml('שלום 日本 🎉'), 'שלום 日本 🎉');
});
