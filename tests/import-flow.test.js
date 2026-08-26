// Regression tests for the JSON import path.
//
// WHY THIS FILE EXISTS: 4.4.2 shipped a ReferenceError in the file-input
// handler. It referenced `imgs.items.length` and `vids.items.length`, two
// variables that had been removed when the handler was rewritten to use
// adoptLibrary(). The throw happened AFTER adoptLibrary() and BEFORE
// chrome.storage.local.set(), so JSON import updated the library in memory and
// never persisted it.
//
// 368 tests passed. parseImportPayload was covered. sanitizeImportedList was
// covered. Nothing executed the code that JOINS them — so the bug was invisible
// to the suite. These tests exercise the actual application path.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGallery } = require('./_setup');

const IMG = 'https://scontent.cdninstagram.com/v/t51/photo_n.jpg';
const VID = 'https://video-lhr8.xx.fbcdn.net/v/t66/clip.mp4';
const POST = 'https://www.instagram.com/p/Cabc123_/';

// A gallery whose storage writes and status updates are observable.
function harness(initial) {
  const writes = [];
  const statuses = [];
  const rendered = { grid: 0, counts: 0 };
  const sandbox = loadGallery((s) => {
    s.chrome.runtime.id = 'test-id';
    s.chrome.storage.local.get = (_k, cb) => cb(
      initial ? { igExporterData: initial } : {});
    s.chrome.storage.local.set = (d, cb) => { writes.push(d); if (cb) cb(); };
  });
  // Observe the side effects the handler is supposed to produce.
  sandbox.setStatus = (m) => { statuses.push(m); };
  sandbox.renderGrid = () => { rendered.grid++; };
  sandbox.updateCounts = () => { rendered.counts++; };
  return { sandbox, writes, statuses, rendered };
}

function fileInputStub() {
  return { value: 'C:\\fake\\path\\backup.json' };
}

function jsonPayload(images, videos) {
  return JSON.stringify({
    format: 'saved-posts-backup-export',
    formatVersion: 1,
    images: images,
    videos: videos
  });
}

// ---------------------------------------------------------------------------
// The regression itself
// ---------------------------------------------------------------------------

test('runImport: a valid JSON import does not throw', () => {
  const { sandbox } = harness();
  const text = jsonPayload([{ type: 'image', url: IMG }], [{ type: 'video', url: VID }]);
  assert.doesNotThrow(() => sandbox.runImport(text, fileInputStub()),
    'this is the 4.4.2 ReferenceError; it must never come back');
});

test('runImport: sanitized images and videos become the current library', () => {
  const { sandbox } = harness();
  sandbox.runImport(
    jsonPayload([{ type: 'image', url: IMG }], [{ type: 'video', url: VID }]),
    fileInputStub());
  assert.equal(sandbox.allMedia.images.length, 1);
  assert.equal(sandbox.allMedia.videos.length, 1);
  assert.equal(sandbox.allMedia.images[0].url, IMG);
  assert.equal(sandbox.allMedia.videos[0].url, VID);
});

test('runImport: chrome.storage.local.set receives the sanitized library', () => {
  // The specific consequence of the bug: the write never happened.
  const { sandbox, writes } = harness();
  sandbox.runImport(
    jsonPayload([{ type: 'image', url: IMG }], [{ type: 'video', url: VID }]),
    fileInputStub());
  const dataWrites = writes.filter(w => w.igExporterData);
  assert.ok(dataWrites.length >= 1, 'the import MUST be persisted');
  const last = JSON.parse(JSON.stringify(dataWrites[dataWrites.length - 1].igExporterData));
  assert.equal(last.images.length, 1);
  assert.equal(last.videos.length, 1);
  assert.equal(last.images[0].url, IMG);
});

test('runImport: counts and grid are re-rendered', () => {
  const { sandbox, rendered } = harness();
  sandbox.runImport(jsonPayload([{ type: 'image', url: IMG }], []), fileInputStub());
  assert.ok(rendered.counts >= 1, 'updateCounts must run');
  assert.ok(rendered.grid >= 1, 'renderGrid must run');
});

test('runImport: the file input is reset so the same file can be re-imported', () => {
  const { sandbox } = harness();
  const input = fileInputStub();
  sandbox.runImport(jsonPayload([{ type: 'image', url: IMG }], []), input);
  assert.equal(input.value, '');
});

test('runImport: status reports correct accepted and rejected counts', () => {
  const { sandbox, statuses } = harness();
  sandbox.runImport(jsonPayload(
    [{ type: 'image', url: IMG },
     { type: 'image', url: 'javascript:alert(1)' },
     { type: 'image', url: 'https://evil.example/x.jpg' }],
    [{ type: 'video', url: VID }]), fileInputStub());
  const msg = statuses[statuses.length - 1];
  assert.match(msg, /Imported 2 items/);
  assert.match(msg, /1 images/);
  assert.match(msg, /1 videos/);
  assert.match(msg, /2 rejected/);
});

test('runImport: hostile URLs never reach storage', () => {
  const { sandbox, writes } = harness();
  sandbox.runImport(jsonPayload([
    { type: 'image', url: 'javascript:alert(1)' },
    { type: 'image', url: 'data:text/html,<script>alert(1)</script>' },
    { type: 'image', url: 'file:///etc/passwd' },
    { type: 'image', url: 'https://evilcdninstagram.com/x.jpg' },
    { type: 'image', url: 'https://cdninstagram.com.evil.example/x.jpg' },
    { type: 'image', url: 'https://user:pass@scontent.cdninstagram.com/x.jpg' },
    { type: 'image', url: IMG, postUrl: 'javascript:alert(2)',
      innerHTML: '<img src=x onerror=alert(3)>', onclick: 'alert(4)' }
  ], []), fileInputStub());

  const dataWrites = writes.filter(w => w.igExporterData);
  const blob = JSON.stringify(dataWrites.map(w => w.igExporterData));
  for (const bad of ['javascript:', 'data:text/html', 'file://',
                     'evilcdninstagram', 'evil.example', 'user:pass',
                     'innerHTML', 'onclick', 'onerror']) {
    assert.equal(blob.includes(bad), false,
      'storage must never contain: ' + bad);
  }
  assert.equal(sandbox.allMedia.images.length, 1, 'only the clean record survives');
  assert.equal(sandbox.allMedia.images[0].postUrl, null);
});

// ---------------------------------------------------------------------------
// applyParsedImport in isolation
// ---------------------------------------------------------------------------

test('applyParsedImport: json format returns real counts, not undefined', () => {
  const { sandbox } = harness();
  const res = sandbox.applyParsedImport({
    format: 'json',
    images: [{ type: 'image', url: IMG }],
    videos: [{ type: 'video', url: VID }]
  });
  assert.equal(res.ok, true);
  assert.equal(res.format, 'json');
  assert.equal(res.images, 1);
  assert.equal(res.videos, 1);
  assert.equal(res.accepted, 2);
  assert.equal(res.rejected, 0);
  assert.equal(typeof res.status, 'string');
  assert.equal(res.status.includes('undefined'), false,
    'a status built from missing variables would show "undefined"');
  assert.equal(res.status.includes('NaN'), false);
});

test('applyParsedImport: txt format drops into the active tab only', () => {
  const { sandbox } = harness();
  sandbox.currentTab = 'images';
  const res = sandbox.applyParsedImport({ format: 'txt', urls: [IMG, 'javascript:alert(1)'] });
  assert.equal(res.format, 'txt');
  assert.equal(res.accepted, 1);
  assert.equal(res.rejected, 1);
  assert.match(res.status, /1 URLs/);
});

test('applyParsedImport: a post-only record is preserved through import', () => {
  const { sandbox } = harness();
  const res = sandbox.applyParsedImport({
    format: 'json',
    images: [],
    videos: [{ type: 'video', url: null, thumbnail: null, postUrl: POST }]
  });
  assert.equal(res.videos, 1, 'a valid permalink alone keeps the record');
  assert.equal(sandbox.allMedia.videos[0].postUrl, POST);
  assert.equal(sandbox.allMedia.videos[0].url, null);
});

test('applyParsedImport: garbage input is handled, not thrown', () => {
  const { sandbox } = harness();
  for (const junk of [null, undefined, 'string', 42, []]) {
    let res;
    assert.doesNotThrow(() => { res = sandbox.applyParsedImport(junk); },
      'must not throw on ' + JSON.stringify(junk));
    assert.ok(res && typeof res.status === 'string');
  }
});

// ---------------------------------------------------------------------------
// Failure paths must not leave a half-applied state
// ---------------------------------------------------------------------------

test('runImport: unparseable text reports failure and resets the input', () => {
  const { sandbox, statuses, writes } = harness();
  const input = fileInputStub();
  const before = writes.filter(w => w.igExporterData).length;
  const res = sandbox.runImport('{ not json', input);
  assert.equal(res.ok, false);
  assert.match(statuses[statuses.length - 1], /Import failed/);
  assert.equal(input.value, '');
  assert.equal(writes.filter(w => w.igExporterData).length, before,
    'a failed parse must not write anything');
});

test('runImport: a throw while applying is reported, not swallowed', () => {
  const { sandbox, statuses } = harness();
  const input = fileInputStub();
  // Force a failure inside the apply step.
  sandbox.adoptLibrary = () => { throw new Error('boom'); };
  const res = sandbox.runImport(jsonPayload([{ type: 'image', url: IMG }], []), input);
  assert.equal(res.ok, false);
  assert.match(statuses[statuses.length - 1], /Import failed while applying/);
  assert.equal(input.value, '', 'the input is still reset on the failure path');
});

test('a full export -> clear -> import round trip restores and persists', () => {
  const { sandbox, writes } = harness();
  // Build a library, export it, clear, then import the export back.
  const payload = sandbox.buildExportPayload(
    [{ type: 'image', url: IMG, thumbnail: IMG, postUrl: POST,
       postShortcode: 'Cabc123_', carouselIndex: 0, carouselSize: 2,
       metadata: { caption: 'hello', owner: 'someone', takenAt: null,
                   likeCount: 5, hashtags: ['tag'] },
       scrapedAt: '2026-01-01T00:00:00.000Z' }],
    [{ type: 'video', url: VID, thumbnail: null, postUrl: null }],
    '4.4.3');
  const json = JSON.stringify(payload);

  sandbox.adoptLibrary(null, {});                 // clear
  assert.equal(sandbox.allMedia.images.length, 0);

  const before = writes.filter(w => w.igExporterData).length;
  sandbox.runImport(json, fileInputStub());

  assert.equal(sandbox.allMedia.images.length, 1, 'the image came back');
  assert.equal(sandbox.allMedia.videos.length, 1, 'the video came back');
  assert.equal(sandbox.allMedia.images[0].metadata.caption, 'hello',
    'metadata survived the round trip');
  assert.equal(sandbox.allMedia.images[0].postShortcode, 'Cabc123_');
  assert.ok(writes.filter(w => w.igExporterData).length > before,
    'and it was persisted');
});
