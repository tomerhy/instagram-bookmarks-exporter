// Phase 4 evidence: malformed / hostile postMessage payloads and untrusted
// URLs are rejected.
//
// The threat model these tests encode: capture-hook.js runs in the page's MAIN
// world, so Instagram's own page code (or anything injected into it) can post
// an SBE_MEDIA message. content.js must therefore treat every inbound message
// as attacker-controlled and refuse anything it cannot fully validate.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadContent, loadCaptureHook, loadGallery } = require('./_setup');

const CDN = 'https://scontent.cdninstagram.com/v/t51/real_n.jpg';
const VIDEO = 'https://video-lhr8.xx.fbcdn.net/v/t66/clip.mp4';
const IG_ORIGIN = 'https://www.instagram.com';

function fresh() {
  return loadContent((s) => { s.chrome.runtime.id = 'test-id'; });
}

function post(sandbox, event) {
  sandbox.__emitMessage(event);
}

function goodItem(over) {
  return Object.assign({ type: 'image', url: CDN, thumbnail: null, context: null }, over || {});
}

// ---------------------------------------------------------------------------
// Envelope: sender, origin, shape
// ---------------------------------------------------------------------------

test('rejects a message whose source is not this window', () => {
  const { exposed, sandbox } = fresh();
  exposed.startCapture();
  post(sandbox, {
    source: { name: 'some-iframe' },   // not the page window
    origin: IG_ORIGIN,
    data: { type: 'SBE_MEDIA', media: [goodItem()] }
  });
  assert.equal(exposed.state.images.length, 0);
});

test('rejects a message from an unexpected origin', () => {
  const { exposed, sandbox } = fresh();
  exposed.startCapture();
  for (const origin of ['https://evil.example', 'http://www.instagram.com',
                        'https://instagram.com.evil.example', 'null', '']) {
    post(sandbox, { origin, data: { type: 'SBE_MEDIA', media: [goodItem()] } });
  }
  assert.equal(exposed.state.images.length, 0);
});

test('accepts both legitimate Instagram origins', () => {
  for (const origin of ['https://www.instagram.com', 'https://instagram.com']) {
    const { exposed, sandbox } = fresh();
    exposed.startCapture();
    post(sandbox, { origin, data: { type: 'SBE_MEDIA', media: [goodItem()] } });
    assert.equal(exposed.state.images.length, 1, 'should accept ' + origin);
  }
});

test('rejects malformed envelopes without throwing', () => {
  const { exposed, sandbox } = fresh();
  exposed.startCapture();
  const payloads = [
    undefined,
    null,
    'a string',
    42,
    [],
    { },
    { type: 'SBE_MEDIA' },                       // no media
    { type: 'SBE_MEDIA', media: null },
    { type: 'SBE_MEDIA', media: 'not-an-array' },
    { type: 'SBE_MEDIA', media: {} },
    { type: 'SOMETHING_ELSE', media: [goodItem()] },
    { type: 'IG_EXPORTER_MEDIA', media: [goodItem()] },  // the pre-4.4.1 type
    { media: [goodItem()] }                      // no type
  ];
  for (const data of payloads) {
    assert.doesNotThrow(
      () => post(sandbox, { origin: IG_ORIGIN, data }),
      'payload must be rejected, not thrown on: ' + JSON.stringify(data));
  }
  assert.equal(exposed.state.images.length, 0);
});

test('rejects malformed items inside an otherwise valid envelope', () => {
  const { exposed, sandbox } = fresh();
  exposed.startCapture();
  post(sandbox, {
    origin: IG_ORIGIN,
    data: { type: 'SBE_MEDIA', media: [
      null,
      undefined,
      'string-item',
      42,
      [],
      { type: 'image' },                       // no url
      { type: 'audio', url: CDN },             // unknown type
      { type: 'IMAGE', url: CDN },             // wrong case
      { url: CDN },                            // no type
      { type: 'image', url: 12345 },           // url not a string
      { type: 'image', url: { href: CDN } }
    ] }
  });
  assert.equal(exposed.state.images.length, 0);
  assert.equal(exposed.state.videos.length, 0);
});

test('a valid item still lands when mixed with junk', () => {
  const { exposed, sandbox } = fresh();
  exposed.startCapture();
  post(sandbox, {
    origin: IG_ORIGIN,
    data: { type: 'SBE_MEDIA', media: [
      null, 'junk', { type: 'image' }, goodItem(), { type: 'nope', url: CDN }
    ] }
  });
  assert.equal(exposed.state.images.length, 1, 'the one good item survives');
});

// ---------------------------------------------------------------------------
// URL allowlist
// ---------------------------------------------------------------------------

const REJECTED_URLS = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'data:image/svg+xml,<svg onload=alert(1)>',
  'blob:https://www.instagram.com/8a7f-4c3e',
  'file:///etc/passwd',
  'chrome-extension://abcdefghijklmnop/gallery.html',
  'chrome://settings',
  'about:blank',
  'http://scontent.cdninstagram.com/v/x.jpg',   // plaintext http
  'https://localhost:8080/x.jpg',
  'https://127.0.0.1/x.jpg',
  'https://[::1]/x.jpg',
  'https://evil.example/x.jpg',
  'https://evilcdninstagram.com/x.jpg',         // suffix-confusion
  'https://cdninstagram.com.evil.example/x.jpg',
  'https://fbcdn.net.evil.example/x.jpg',
  'https://user:pass@scontent.cdninstagram.com/x.jpg',  // embedded credentials
  '//scontent.cdninstagram.com/x.jpg',          // protocol-relative
  ''
];

test('rejects every non-allowlisted media URL', () => {
  for (const url of REJECTED_URLS) {
    const { exposed, sandbox } = fresh();
    exposed.startCapture();
    post(sandbox, {
      origin: IG_ORIGIN,
      data: { type: 'SBE_MEDIA', media: [{ type: 'image', url: url, context: null }] }
    });
    assert.equal(exposed.state.images.length, 0, 'must reject: ' + url);
  }
});

test('accepts real Instagram/Meta CDN URLs', () => {
  const accepted = [
    CDN,
    VIDEO,
    'https://instagram.flhr2-1.fna.fbcdn.net/v/t51/x_n.jpg',
    'https://scontent-lhr6-2.cdninstagram.com/v/t51.2885-15/x_n.jpg?ig_cache_key=a&stp=b'
  ];
  for (const url of accepted) {
    const { exposed, sandbox } = fresh();
    exposed.startCapture();
    const type = url.endsWith('.mp4') ? 'video' : 'image';
    post(sandbox, {
      origin: IG_ORIGIN,
      data: { type: 'SBE_MEDIA', media: [{ type, url, context: null }] }
    });
    const stored = exposed.state.images.length + exposed.state.videos.length;
    assert.equal(stored, 1, 'must accept: ' + url);
  }
});

test('a rejected thumbnail does not poison an otherwise valid item', () => {
  const { exposed, sandbox } = fresh();
  exposed.startCapture();
  post(sandbox, {
    origin: IG_ORIGIN,
    data: { type: 'SBE_MEDIA', media: [
      { type: 'video', url: VIDEO, thumbnail: 'javascript:alert(1)', context: null }
    ] }
  });
  assert.equal(exposed.state.videos.length, 1);
  // The item is kept but the hostile thumbnail must not be.
  assert.notEqual(exposed.state.videos[0].thumbnail, 'javascript:alert(1)');
});

// ---------------------------------------------------------------------------
// Field-level limits and coercion
// ---------------------------------------------------------------------------

test('caption is clamped, not stored unbounded', () => {
  const { exposed, sandbox } = fresh();
  exposed.startCapture();
  post(sandbox, {
    origin: IG_ORIGIN,
    data: { type: 'SBE_MEDIA', media: [goodItem({
      context: { postShortcode: 'ABC123', caption: 'x'.repeat(500000) }
    })] }
  });
  const caption = exposed.state.images[0].metadata.caption;
  assert.equal(caption.length, exposed.LIMITS.caption,
    'caption must be truncated to the documented limit');
});

test('owner is rejected unless it looks like an Instagram username', () => {
  const cases = [
    ['good.user_1', 'good.user_1'],
    ['<img src=x onerror=alert(1)>', null],
    ['a b', null],
    ['drop/table', null],
    ['x'.repeat(200), null],   // over-length truncates to 30 then still valid
    [42, null],
    [{}, null]
  ];
  for (const [input, expected] of cases) {
    const { exposed, sandbox } = fresh();
    exposed.startCapture();
    post(sandbox, {
      origin: IG_ORIGIN,
      data: { type: 'SBE_MEDIA', media: [goodItem({
        context: { postShortcode: 'ABC123', owner: input }
      })] }
    });
    const owner = exposed.state.images[0].metadata.owner;
    if (expected === null) {
      // 'x'.repeat(200) truncates to 30 valid chars, so allow that one case.
      assert.ok(owner === null || /^[A-Za-z0-9._]+$/.test(owner),
        'owner must be null or a valid username, got: ' + JSON.stringify(owner));
    } else {
      assert.equal(owner, expected);
    }
  }
});

test('shortcode with path traversal or markup is dropped', () => {
  for (const bad of ['../../etc/passwd', 'a/b', '<script>', 'a b', 'x'.repeat(200) + '/..']) {
    const { exposed, sandbox } = fresh();
    exposed.startCapture();
    post(sandbox, {
      origin: IG_ORIGIN,
      data: { type: 'SBE_MEDIA', media: [goodItem({ context: { postShortcode: bad } })] }
    });
    const code = exposed.state.images[0].postShortcode;
    assert.ok(code === null || /^[A-Za-z0-9_-]+$/.test(code),
      'shortcode must be null or safe, got: ' + JSON.stringify(code));
  }
});

test('numeric fields reject NaN, Infinity, negatives and strings', () => {
  const { exposed } = fresh();
  for (const bad of [NaN, Infinity, -Infinity, -5, '100', null, undefined, {}]) {
    assert.equal(exposed.cleanCount(bad), null, 'cleanCount must reject ' + String(bad));
  }
  assert.equal(exposed.cleanCount(0), 0);
  assert.equal(exposed.cleanCount(12.7), 12);
});

test('carouselIndex outside the documented range is dropped', () => {
  const { exposed } = fresh();
  assert.equal(exposed.cleanIndex(0, 50), 0);
  assert.equal(exposed.cleanIndex(49, 50), 49);
  assert.equal(exposed.cleanIndex(50, 50), null);
  assert.equal(exposed.cleanIndex(1e9, 50), null);
  assert.equal(exposed.cleanIndex(-1, 50), null);
});

test('takenAt must be a parseable timestamp', () => {
  const { exposed } = fresh();
  assert.equal(exposed.cleanTimestamp('2026-01-01T00:00:00.000Z'), '2026-01-01T00:00:00.000Z');
  assert.equal(exposed.cleanTimestamp('not a date'), null);
  assert.equal(exposed.cleanTimestamp(1234567890), null);
  assert.equal(exposed.cleanTimestamp('<script>'), null);
});

test('an oversized batch is capped at the documented per-message limit', () => {
  const { exposed, sandbox } = fresh();
  exposed.startCapture();
  const huge = [];
  for (let i = 0; i < 5000; i++) {
    huge.push({ type: 'image', url: CDN + '?i=' + i, context: null });
  }
  post(sandbox, { origin: IG_ORIGIN, data: { type: 'SBE_MEDIA', media: huge } });
  assert.ok(exposed.state.images.length <= exposed.LIMITS.mediaPerMessage,
    'stored ' + exposed.state.images.length + ' items, limit is ' + exposed.LIMITS.mediaPerMessage);
});

test('the stored-record ceiling stops further growth', () => {
  const { exposed, sandbox } = fresh();
  exposed.startCapture();
  // Pretend we are already at the cap.
  exposed.state.images.length = 0;
  for (let i = 0; i < exposed.LIMITS.recordsPerBucket; i++) {
    exposed.state.images.push({ type: 'image', url: 'x' + i });
  }
  assert.equal(exposed.atRecordLimit(), true);
  post(sandbox, { origin: IG_ORIGIN, data: { type: 'SBE_MEDIA', media: [goodItem()] } });
  assert.equal(exposed.state.images.length, exposed.LIMITS.recordsPerBucket,
    'nothing may be appended once the ceiling is reached');
});

// ---------------------------------------------------------------------------
// The MAIN-world reader applies the same URL rules before forwarding
// ---------------------------------------------------------------------------

test('capture-hook.js: extraction drops non-allowlisted URLs', () => {
  const { exposed } = loadCaptureHook();
  const media = exposed.extractMediaFromData({
    items: [
      { code: 'AAA', media_type: 1, image_versions2: { candidates: [{ url: 'javascript:alert(1)' }] } },
      { code: 'BBB', media_type: 1, image_versions2: { candidates: [{ url: 'https://evil.example/x.jpg' }] } },
      { code: 'CCC', media_type: 1, image_versions2: { candidates: [{ url: CDN }] } }
    ]
  });
  assert.equal(media.length, 1, 'only the CDN URL should survive extraction');
  assert.equal(media[0].url, CDN);
});

test('capture-hook.js: recursion is depth-limited', () => {
  const { exposed } = loadCaptureHook();
  // Bury a valid item deeper than MAX_DEPTH; extraction must not find it, and
  // must not blow the stack looking.
  let node = { code: 'DEEP', media_type: 1, image_versions2: { candidates: [{ url: CDN }] } };
  for (let i = 0; i < 60; i++) node = { nested: node };
  let media;
  assert.doesNotThrow(() => { media = exposed.extractMediaFromData(node); });
  assert.equal(media.length, 0, 'anything past the depth limit is simply not walked');
});

test('capture-hook.js: a self-referential response does not hang extraction', () => {
  const { exposed } = loadCaptureHook();
  const cyclic = { code: 'LOOP', media_type: 1, image_versions2: { candidates: [{ url: CDN }] } };
  cyclic.self = cyclic;
  let media;
  assert.doesNotThrow(() => { media = exposed.extractMediaFromData(cyclic); });
  assert.ok(media.length >= 1, 'the real item is still found');
  assert.ok(media.length <= exposed.MAX_RESULTS_PER_RESPONSE,
    'the result cap holds even on a cycle');
});

test('capture-hook.js: results per response are capped', () => {
  const { exposed } = loadCaptureHook();
  const items = [];
  for (let i = 0; i < 3000; i++) {
    items.push({ code: 'C' + i, media_type: 1, image_versions2: { candidates: [{ url: CDN + '?i=' + i }] } });
  }
  const media = exposed.extractMediaFromData({ items });
  assert.ok(media.length <= exposed.MAX_RESULTS_PER_RESPONSE,
    'got ' + media.length + ', cap is ' + exposed.MAX_RESULTS_PER_RESPONSE);
});

// ---------------------------------------------------------------------------
// Import: the other untrusted input path
// ---------------------------------------------------------------------------

test('import: records with hostile URLs are dropped, not cleaned', () => {
  const sandbox = loadGallery();

  const result = sandbox.sanitizeImportedList([
    { type: 'image', url: 'javascript:alert(1)', thumbnail: 'javascript:alert(1)' },
    { type: 'image', url: 'https://evil.example/x.jpg' },
    { type: 'image', url: 'file:///etc/passwd' },
    { type: 'image', url: 'chrome-extension://abc/gallery.html' },
    { type: 'image', url: CDN },
    'not-an-object',
    null
  ], 'image');

  assert.equal(result.items.length, 1, 'only the CDN record may survive import');
  assert.equal(result.items[0].url, CDN);
  assert.equal(result.dropped, 6);
});

test('import: extra properties on an imported record are not carried over', () => {
  const sandbox = loadGallery();

  const clean = sandbox.sanitizeImportedItem({
    type: 'image',
    url: CDN,
    __proto__evil: 'x',
    onerror: 'alert(1)',
    innerHTML: '<script>alert(1)</script>',
    postUrl: 'javascript:alert(1)'
  }, 'image');

  assert.equal(clean.onerror, undefined, 'unexpected keys must not be copied');
  assert.equal(clean.innerHTML, undefined);
  assert.equal(clean.postUrl, null, 'a non-Instagram postUrl must be dropped');
  assert.equal(clean.url, CDN);
});
