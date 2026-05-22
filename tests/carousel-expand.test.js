// Tests for the v4.3.7 inline carousel expansion in the gallery.
//
// Behaviour: clicking the album badge on a card expands that card inline
// into a horizontal strip of all the album's slides. The data needed to
// render the strip is already grouped onto each item by getCurrentItems()
// (see grouping.test.js), so these tests pin two pieces:
//
//   1. The pure helpers — getCarouselSlides, buildCarouselStrip — produce
//      the right shapes for any item shape.
//   2. The state machine — expandCarousel / collapseCarousel — maintains
//      the "at most one expanded card at a time" invariant.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTopLevel } = require('./_setup');

// A richer mock element than _setup.js provides. _setup's createElement
// returns stubs where setAttribute / classList are no-ops, which breaks
// assertions on attribute and class state. We override createElement in the
// sandbox so gallery.js's internal createElement() calls return these too.
function mockEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [],
    parentNode: null,
    _attrs: {},
    _events: {},
    style: {},
    src: '',
    alt: '',
    loading: '',
    title: '',
    textContent: '',
    innerHTML: '',
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); }
    },
    get className() { return Array.from(this.classList._set).join(' '); },
    set className(v) {
      this.classList._set = new Set(String(v).split(/\s+/).filter(Boolean));
    },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; },
    removeAttribute(k) { delete this._attrs[k]; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
    },
    addEventListener(ev, fn) { (this._events[ev] = this._events[ev] || []).push(fn); },
    removeEventListener() {},
    dispatchEvent() {},
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    },
    querySelector(sel) {
      const m = sel.match(/^\.(.+)$/);
      if (!m) return null;
      const cls = m[1];
      function find(node) {
        for (const c of (node.children || [])) {
          if (c.classList && c.classList.contains && c.classList.contains(cls)) return c;
          const sub = find(c);
          if (sub) return sub;
        }
        return null;
      }
      return find(this);
    },
    closest() { return null; }
  };
  return el;
}

function loadGallery() {
  // Override createElement so gallery.js's internal element creation produces
  // richer mocks we can assert on. This must run *before* gallery.js executes.
  return loadTopLevel('gallery.js', function (sandbox) {
    sandbox.document.createElement = function (tag) { return mockEl(tag); };
  });
}

// ---------- getCarouselSlides ----------

test('getCarouselSlides: returns the _carouselSlides array when present', () => {
  const g = loadGallery();
  const slides = [{ url: 'a.jpg' }, { url: 'b.jpg' }];
  assert.equal(g.getCarouselSlides({ _carouselSlides: slides }).length, 2);
});

test('getCarouselSlides: returns [] for non-album items', () => {
  const g = loadGallery();
  assert.equal(g.getCarouselSlides({ url: 'a.jpg' }).length, 0);
  assert.equal(g.getCarouselSlides(null).length, 0);
  assert.equal(g.getCarouselSlides(undefined).length, 0);
  assert.equal(g.getCarouselSlides({}).length, 0);
});

// ---------- buildCarouselStrip ----------

test('buildCarouselStrip: one button per slide in order', () => {
  const g = loadGallery();
  const slides = [
    { thumbnail: 'a.jpg' },
    { thumbnail: 'b.jpg' },
    { thumbnail: 'c.jpg' }
  ];
  const strip = g.buildCarouselStrip(slides);
  // Each slide becomes a <button> child of the strip, with an inner <img>.
  // We can't rely on tagName from JSDOM (no JSDOM here), but createElement
  // returns the sandbox's mockElement which preserves children.
  assert.equal(strip.children.length, 3, 'one element per slide');
  for (let i = 0; i < strip.children.length; i++) {
    const btn = strip.children[i];
    assert.equal(btn.getAttribute('data-slide-index'), String(i),
      'slide index should match position');
  }
});

test('buildCarouselStrip: prefers thumbnail over url for the <img>', () => {
  const g = loadGallery();
  const slides = [
    { thumbnail: 'thumb-a.jpg', url: 'full-a.jpg' },
    { url: 'only-b.jpg' }   // no thumbnail → falls back to url
  ];
  const strip = g.buildCarouselStrip(slides);
  // strip > button > img — the img's src is set
  const imgA = strip.children[0].children[0];
  const imgB = strip.children[1].children[0];
  assert.equal(imgA.src, 'thumb-a.jpg', 'thumbnail wins when present');
  assert.equal(imgB.src, 'only-b.jpg',  'falls back to url when no thumbnail');
});

test('buildCarouselStrip: empty slide list produces an empty strip', () => {
  const g = loadGallery();
  const strip = g.buildCarouselStrip([]);
  assert.equal(strip.children.length, 0);
});

test('buildCarouselStrip: aria-label includes position and total', () => {
  const g = loadGallery();
  const slides = [{ url: 'a.jpg' }, { url: 'b.jpg' }, { url: 'c.jpg' }];
  const strip = g.buildCarouselStrip(slides);
  assert.equal(strip.children[1].getAttribute('aria-label'), 'Slide 2 of 3');
});

// ---------- expandCarousel / collapseCarousel state machine ----------

test('expandCarousel: sets the carousel-expanded class and tracks the global', () => {
  const g = loadGallery();
  const card = mockEl();
  const item = { _carouselSlides: [{ url: 'a.jpg' }, { url: 'b.jpg' }] };

  g.expandCarousel(card, item);

  assert.equal(card.classList.contains('carousel-expanded'), true);
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  assert.equal(g.expandedCard, card, 'expandedCard global should track the open card');
});

test('expandCarousel: clicking the same card again collapses it', () => {
  const g = loadGallery();
  const card = mockEl();
  const item = { _carouselSlides: [{ url: 'a.jpg' }] };

  g.expandCarousel(card, item);
  g.expandCarousel(card, item);

  assert.equal(card.classList.contains('carousel-expanded'), false,
    'second expand call should toggle off');
  assert.equal(g.expandedCard, null);
});

test('expandCarousel: opening another card collapses the previous one (invariant)', () => {
  const g = loadGallery();
  const cardA = mockEl();
  const cardB = mockEl();
  const itemA = { _carouselSlides: [{ url: 'a.jpg' }] };
  const itemB = { _carouselSlides: [{ url: 'b.jpg' }] };

  g.expandCarousel(cardA, itemA);
  assert.equal(g.expandedCard, cardA);

  g.expandCarousel(cardB, itemB);

  assert.equal(cardA.classList.contains('carousel-expanded'), false,
    'previous card must be collapsed when a new one opens');
  assert.equal(cardB.classList.contains('carousel-expanded'), true);
  assert.equal(g.expandedCard, cardB);
});

test('expandCarousel: refuses to open a non-album item (no slides → no-op)', () => {
  const g = loadGallery();
  const card = mockEl();
  const item = { _carouselSlides: [] };

  g.expandCarousel(card, item);

  assert.equal(card.classList.contains('carousel-expanded'), false);
  assert.equal(g.expandedCard, null);
});

test('collapseCarousel: removes the strip from the card and clears the global', () => {
  const g = loadGallery();
  const card = mockEl();
  const item = { _carouselSlides: [{ url: 'a.jpg' }, { url: 'b.jpg' }] };

  g.expandCarousel(card, item);
  // The strip should be a child of the card now.
  const strip = card.querySelector('.carousel-strip');
  assert.ok(strip, 'expand should append a .carousel-strip child');

  g.collapseCarousel();

  assert.equal(card.classList.contains('carousel-expanded'), false);
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  assert.equal(card.querySelector('.carousel-strip'), null,
    'collapse should remove the strip from the DOM');
  assert.equal(g.expandedCard, null);
});

test('collapseCarousel: safe to call when nothing is expanded (defensive)', () => {
  const g = loadGallery();
  assert.doesNotThrow(() => g.collapseCarousel(),
    'no-op when expandedCard is null');
});

// ---------- Interaction with resetViewer ----------

test('resetViewer: also collapses any expanded carousel (clearing data must reset everything)', () => {
  const g = loadGallery();
  const card = mockEl();
  const item = { _carouselSlides: [{ url: 'a.jpg' }] };
  g.expandCarousel(card, item);
  assert.equal(g.expandedCard, card);

  g.resetViewer();

  assert.equal(g.expandedCard, null,
    'after Clear All, no carousel should remain expanded pointing at deleted data');
  assert.equal(card.classList.contains('carousel-expanded'), false);
});
