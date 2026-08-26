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
    style: (function () {
      const props = {};
      return {
        _props: props,
        setProperty(k, v) { props[k] = String(v); },
        getPropertyValue(k) { return props[k] || ''; },
        removeProperty(k) { delete props[k]; }
      };
    })(),
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
    addEventListener(ev, fn, opts) {
      (this._events[ev] = this._events[ev] || []).push({ fn, opts: opts || {} });
    },
    removeEventListener(ev, fn) {
      if (!this._events[ev]) return;
      this._events[ev] = this._events[ev].filter(l => l.fn !== fn);
    },
    // Fire all listeners for `name` (string or event-like). Honors `{once:true}`.
    dispatchEvent(name) {
      const evName = typeof name === 'string' ? name : (name && name.type);
      const listeners = this._events[evName] || [];
      const survivors = [];
      for (const { fn, opts } of listeners) {
        try { fn({ type: evName, target: this }); } catch (_) {}
        if (!opts || !opts.once) survivors.push({ fn, opts });
      }
      this._events[evName] = survivors;
    },
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    },
    querySelector(sel) {
      // Supports: ".class" and ".class:not(.other)" — enough for our needs.
      const m = sel.match(/^\.([\w-]+)(?::not\(\.([\w-]+)\))?$/);
      if (!m) return null;
      const cls = m[1];
      const not = m[2];
      function find(node) {
        for (const c of (node.children || [])) {
          if (c.classList && c.classList.contains &&
              c.classList.contains(cls) &&
              (!not || !c.classList.contains(not))) {
            return c;
          }
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
  //
  // The dep list mirrors gallery.html's <script> order: without
  // url-allowlist.js and library-sanitize.js, SBE_URL is absent, every URL
  // fails closed, and img.src would come back as "" for reasons unrelated to
  // what these tests are checking.
  return loadTopLevel('gallery.js', function (sandbox) {
    sandbox.document.createElement = function (tag) { return mockEl(tag); };
  }, ['url-allowlist.js', 'library-sanitize.js']);
}

// ---------- getCarouselSlides ----------

test('getCarouselSlides: returns the _carouselSlides array when present', () => {
  const g = loadGallery();
  const slides = [{ url: 'https://scontent.cdninstagram.com/a.jpg' }, { url: 'https://scontent.cdninstagram.com/b.jpg' }];
  assert.equal(g.getCarouselSlides({ _carouselSlides: slides }).length, 2);
});

test('getCarouselSlides: returns [] for non-album items', () => {
  const g = loadGallery();
  assert.equal(g.getCarouselSlides({ url: 'https://scontent.cdninstagram.com/a.jpg' }).length, 0);
  assert.equal(g.getCarouselSlides(null).length, 0);
  assert.equal(g.getCarouselSlides(undefined).length, 0);
  assert.equal(g.getCarouselSlides({}).length, 0);
});

// ---------- buildCarouselStrip ----------

test('buildCarouselStrip: one button per slide in order', () => {
  const g = loadGallery();
  const slides = [
    { thumbnail: 'https://scontent.cdninstagram.com/a.jpg' },
    { thumbnail: 'https://scontent.cdninstagram.com/b.jpg' },
    { thumbnail: 'https://scontent.cdninstagram.com/c.jpg' }
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
    { thumbnail: 'https://scontent.cdninstagram.com/thumb-a.jpg', url: 'https://scontent.cdninstagram.com/full-a.jpg' },
    { url: 'https://scontent.cdninstagram.com/only-b.jpg' }   // no thumbnail → falls back to url
  ];
  const strip = g.buildCarouselStrip(slides);
  // strip > button > img — the img's src is set
  const imgA = strip.children[0].children[0];
  const imgB = strip.children[1].children[0];
  assert.equal(imgA.src, 'https://scontent.cdninstagram.com/thumb-a.jpg', 'thumbnail wins when present');
  assert.equal(imgB.src, 'https://scontent.cdninstagram.com/only-b.jpg',  'falls back to url when no thumbnail');
});

test('buildCarouselStrip: empty slide list produces an empty strip', () => {
  const g = loadGallery();
  const strip = g.buildCarouselStrip([]);
  assert.equal(strip.children.length, 0);
});

test('buildCarouselStrip: aria-label includes position and total', () => {
  const g = loadGallery();
  const slides = [{ url: 'https://scontent.cdninstagram.com/a.jpg' }, { url: 'https://scontent.cdninstagram.com/b.jpg' }, { url: 'https://scontent.cdninstagram.com/c.jpg' }];
  const strip = g.buildCarouselStrip(slides);
  assert.equal(strip.children[1].getAttribute('aria-label'), 'Slide 2 of 3');
});

// ---------- expandCarousel / collapseCarousel state machine ----------

test('expandCarousel: sets the carousel-expanded class and tracks the global', () => {
  const g = loadGallery();
  const card = mockEl();
  const item = { _carouselSlides: [{ url: 'https://scontent.cdninstagram.com/a.jpg' }, { url: 'https://scontent.cdninstagram.com/b.jpg' }] };

  g.expandCarousel(card, item);

  assert.equal(card.classList.contains('carousel-expanded'), true);
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  assert.equal(g.expandedCard, card, 'expandedCard global should track the open card');
});

test('expandCarousel: clicking the same card again triggers an animated close', () => {
  const g = loadGallery();
  const card = mockEl();
  const item = { _carouselSlides: [{ url: 'https://scontent.cdninstagram.com/a.jpg' }] };

  g.expandCarousel(card, item);
  const drawer = card.querySelector('.carousel-drawer');
  g.expandCarousel(card, item);  // toggle off

  // expandedCard is nulled immediately so a re-expand can race in.
  assert.equal(g.expandedCard, null);
  // The drawer is mid-animation, not yet removed.
  assert.equal(drawer.classList.contains('is-closing'), true,
    'toggle close should set is-closing for the keyframe to play');
  assert.equal(card.classList.contains('carousel-expanded'), true,
    'card stays in expanded layout while the drawer animates out');

  // Simulate the animation completing → finalize fires
  drawer.dispatchEvent('animationend');

  assert.equal(card.classList.contains('carousel-expanded'), false,
    'after animationend, card collapses back to its grid slot');
  assert.equal(card.querySelector('.carousel-drawer'), null,
    'after animationend, drawer DOM is removed');
});

test('expandCarousel: opening another card collapses the previous one (invariant)', () => {
  const g = loadGallery();
  const cardA = mockEl();
  const cardB = mockEl();
  const itemA = { _carouselSlides: [{ url: 'https://scontent.cdninstagram.com/a.jpg' }] };
  const itemB = { _carouselSlides: [{ url: 'https://scontent.cdninstagram.com/b.jpg' }] };

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

test('collapseCarousel({ instant: true }): synchronous full cleanup, no animation', () => {
  const g = loadGallery();
  const card = mockEl();
  const item = { _carouselSlides: [{ url: 'https://scontent.cdninstagram.com/a.jpg' }, { url: 'https://scontent.cdninstagram.com/b.jpg' }] };

  g.expandCarousel(card, item);
  const strip = card.querySelector('.carousel-strip');
  assert.ok(strip, 'expand should append a .carousel-strip child');

  g.collapseCarousel({ instant: true });

  assert.equal(card.classList.contains('carousel-expanded'), false);
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  assert.equal(card.querySelector('.carousel-strip'), null,
    'instant collapse removes the strip immediately');
  assert.equal(card.querySelector('.carousel-drawer'), null,
    'instant collapse removes the drawer immediately');
  assert.equal(g.expandedCard, null);
});

test('collapseCarousel: animated by default — drawer fades out before removal', () => {
  const g = loadGallery();
  const card = mockEl();
  const item = { _carouselSlides: [{ url: 'https://scontent.cdninstagram.com/a.jpg' }] };
  g.expandCarousel(card, item);
  const drawer = card.querySelector('.carousel-drawer');

  g.collapseCarousel();  // animated

  // expandedCard cleared right away; DOM cleanup deferred to animationend
  assert.equal(g.expandedCard, null,
    'global is freed immediately so a re-expand can race in');
  assert.equal(drawer.classList.contains('is-closing'), true,
    'is-closing class triggers the drawer-close keyframe');
  assert.equal(card.classList.contains('carousel-expanded'), true,
    'card stays in expanded layout while drawer animates out');
  assert.ok(card.querySelector('.carousel-drawer'),
    'drawer is still in the DOM during the close animation');

  drawer.dispatchEvent('animationend');

  assert.equal(card.classList.contains('carousel-expanded'), false);
  assert.equal(card.querySelector('.carousel-drawer'), null);
});

test('collapseCarousel: safe to call when nothing is expanded (defensive)', () => {
  const g = loadGallery();
  assert.doesNotThrow(() => g.collapseCarousel(),
    'no-op when expandedCard is null');
});

// ---------- Drawer structure (the redesigned shell, v4.3.8) ----------

test('expandCarousel: wraps the strip in a .carousel-drawer with a header + close button', () => {
  const g = loadGallery();
  const card = mockEl();
  const item = { _carouselSlides: [{ url: 'https://scontent.cdninstagram.com/a.jpg' }, { url: 'https://scontent.cdninstagram.com/b.jpg' }, { url: 'https://scontent.cdninstagram.com/c.jpg' }] };
  g.expandCarousel(card, item);

  const drawer = card.querySelector('.carousel-drawer');
  assert.ok(drawer, 'a .carousel-drawer wrapper should be appended');
  assert.ok(drawer.querySelector('.carousel-drawer-header'),
    'drawer should include a header (count + close)');
  assert.ok(drawer.querySelector('.carousel-drawer-close'),
    'drawer should include a close button');
  assert.ok(drawer.querySelector('.carousel-strip'),
    'drawer should still contain the slide strip');
});

test('buildCarouselStrip: each slide sets a --i CSS var for stagger', () => {
  const g = loadGallery();
  const slides = [{ url: 'https://scontent.cdninstagram.com/a.jpg' }, { url: 'https://scontent.cdninstagram.com/b.jpg' }, { url: 'https://scontent.cdninstagram.com/c.jpg' }];
  const strip = g.buildCarouselStrip(slides);
  // The mock style records setProperty calls; verify each slide got an --i.
  for (let i = 0; i < strip.children.length; i++) {
    const propValue = strip.children[i].style._props['--i'];
    assert.equal(propValue, String(i),
      'slide ' + i + ' should set --i=' + i + ' for the stagger delay');
  }
});

// ---------- Interaction with resetViewer ----------

test('resetViewer: also collapses any expanded carousel (clearing data must reset everything)', () => {
  const g = loadGallery();
  const card = mockEl();
  const item = { _carouselSlides: [{ url: 'https://scontent.cdninstagram.com/a.jpg' }] };
  g.expandCarousel(card, item);
  assert.equal(g.expandedCard, card);

  g.resetViewer();

  assert.equal(g.expandedCard, null,
    'after Clear All, no carousel should remain expanded pointing at deleted data');
  assert.equal(card.classList.contains('carousel-expanded'), false);
});
