// Regression tests for the gallery Clear button.
//
// Bug being guarded against: pre-v4.3.5, clicking Clear wiped storage and
// re-rendered the grid but left the <video>/<img> viewer untouched. The video
// kept playing (audio in background), the metadata strip kept pointing at
// the deleted item, and any running slideshow kept firing on now-stale state.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTopLevel } = require('./_setup');

function makeMockElement(extra) {
  const el = Object.assign({
    src: '',
    style: { display: '' },
    innerHTML: '',
    paused: false,
    _loaded: false,
    pause() { this.paused = true; },
    load() { this._loaded = true; },
    removeAttribute(name) { if (name === 'src') this.src = ''; },
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); }
    }
  }, extra || {});
  return el;
}

function loadGalleryWithMockedViewer(extraSetup) {
  const sandbox = loadTopLevel('gallery.js', extraSetup);

  // After load, swap in mock elements so resetViewer has something to act on.
  // gallery.js queries these once at the top; reassigning the sandbox vars
  // updates the globals that resetViewer reads inside.
  sandbox.player = makeMockElement({
    src: 'https://cdn/video.mp4',
    style: { display: 'block' }
  });
  sandbox.imageViewer = makeMockElement({
    src: 'https://cdn/image.jpg',
    style: { display: 'block' }
  });
  sandbox.viewerPlaceholder = makeMockElement({
    style: { display: 'none' },
    innerHTML: ''
  });
  // viewer-meta is fetched dynamically by id, not held as a global — so we
  // hook document.getElementById for that one id.
  const viewerMeta = makeMockElement();
  viewerMeta.classList.add('visible');
  viewerMeta.innerHTML = '<div>Owner</div>';
  const realGetEl = sandbox.document.getElementById;
  sandbox.document.getElementById = function (id) {
    if (id === 'viewer-meta') return viewerMeta;
    return realGetEl ? realGetEl(id) : null;
  };
  sandbox._mocks = {
    player: sandbox.player,
    imageViewer: sandbox.imageViewer,
    viewerPlaceholder: sandbox.viewerPlaceholder,
    viewerMeta
  };

  // Pretend a video item is selected so resetViewer has state to wipe.
  sandbox.currentItem = { url: 'https://cdn/video.mp4', type: 'video' };
  sandbox.selectedCard = { _isMock: true };
  return sandbox;
}

test('resetViewer: pauses the video and clears its src', () => {
  const g = loadGalleryWithMockedViewer();
  g.resetViewer();
  assert.equal(g._mocks.player.paused, true, 'video should be paused');
  assert.equal(g._mocks.player.src, '', 'video src should be cleared');
  assert.equal(g._mocks.player.style.display, 'none', 'video should be hidden');
});

test('resetViewer: clears the image-viewer src and hides it', () => {
  const g = loadGalleryWithMockedViewer();
  g.resetViewer();
  assert.equal(g._mocks.imageViewer.src, '', 'image src should be cleared');
  assert.equal(g._mocks.imageViewer.style.display, 'none', 'image should be hidden');
});

test('resetViewer: restores the "Select an item" placeholder', () => {
  const g = loadGalleryWithMockedViewer();
  g.resetViewer();
  assert.equal(g._mocks.viewerPlaceholder.style.display, 'flex');
  assert.match(g._mocks.viewerPlaceholder.innerHTML, /Select an item/);
});

test('resetViewer: hides and empties the metadata strip', () => {
  const g = loadGalleryWithMockedViewer();
  g.resetViewer();
  assert.equal(g._mocks.viewerMeta.classList.contains('visible'), false,
    'viewer-meta should lose its .visible class');
  assert.equal(g._mocks.viewerMeta.innerHTML, '',
    'viewer-meta should be emptied so it does not point at a deleted item');
});

test('resetViewer: stops a running slideshow', () => {
  const g = loadGalleryWithMockedViewer();
  // Simulate an active slideshow interval — the test setInterval returns a
  // numeric id which stopSlideshow should clearInterval() on.
  g.slideshowInterval = 12345;
  let cleared = null;
  g.clearInterval = function (id) { cleared = id; };

  g.resetViewer();

  assert.equal(cleared, 12345, 'the active slideshow interval should be cleared');
  assert.equal(g.slideshowInterval, null, 'slideshowInterval handle should be nulled');
});

test('resetViewer: nulls the selection globals', () => {
  const g = loadGalleryWithMockedViewer();
  g.resetViewer();
  assert.equal(g.currentItem, null);
  assert.equal(g.selectedCard, null);
});

test('resetViewer: safe to call with missing DOM (defensive guards)', () => {
  // Load without our mock wiring — every viewer element will be null because
  // the test sandbox's getElementById returns null by default.
  const g = loadTopLevel('gallery.js');
  assert.doesNotThrow(() => g.resetViewer(),
    'resetViewer should no-op gracefully when its DOM targets are missing');
});
