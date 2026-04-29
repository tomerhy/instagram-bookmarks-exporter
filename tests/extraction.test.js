// Tests for injector.js metadata extraction across the API shapes Instagram
// actually serves: REST v1 (saved-posts feed), GraphQL (legacy + sidecar
// carousels), and XDT (the newer connection format used by /api/v1/feed).
//
// Covers QA section 4 ("Metadata display") at the unit level. The integration
// counterpart (does the popup actually show the right caption?) stays manual.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadIIFE } = require('./_setup');

const { exposed: injector } = loadIIFE('injector.js');
const {
  extractCaption, extractOwner, extractTakenAt, extractLikeCount,
  buildContext, extractMediaFromData
} = injector;

test('extractCaption: REST v1 shape ({ text })', () => {
  assert.equal(extractCaption({ caption: { text: 'hello world #love' } }), 'hello world #love');
});

test('extractCaption: legacy string shape', () => {
  assert.equal(extractCaption({ caption: 'plain string caption' }), 'plain string caption');
});

test('extractCaption: GraphQL edge_media_to_caption shape', () => {
  const data = { edge_media_to_caption: { edges: [{ node: { text: 'graphql caption' } }] } };
  assert.equal(extractCaption(data), 'graphql caption');
});

test('extractCaption: missing caption returns null', () => {
  assert.equal(extractCaption({}), null);
  assert.equal(extractCaption(null), null);
});

test('extractOwner: prefers user.username', () => {
  assert.equal(extractOwner({ user: { username: 'alice' } }), 'alice');
});

test('extractOwner: falls back to owner.username', () => {
  assert.equal(extractOwner({ owner: { username: 'bob' } }), 'bob');
});

test('extractOwner: missing returns null', () => {
  assert.equal(extractOwner({}), null);
});

test('extractTakenAt: REST taken_at (unix seconds) → ISO', () => {
  // 2024-01-01T00:00:00Z = 1704067200
  const iso = extractTakenAt({ taken_at: 1704067200 });
  assert.equal(iso, '2024-01-01T00:00:00.000Z');
});

test('extractTakenAt: GraphQL taken_at_timestamp', () => {
  const iso = extractTakenAt({ taken_at_timestamp: 1704067200 });
  assert.equal(iso, '2024-01-01T00:00:00.000Z');
});

test('extractTakenAt: missing returns null', () => {
  assert.equal(extractTakenAt({}), null);
});

test('extractLikeCount: prefers like_count', () => {
  assert.equal(extractLikeCount({ like_count: 42 }), 42);
});

test('extractLikeCount: GraphQL edge_media_preview_like.count', () => {
  assert.equal(extractLikeCount({ edge_media_preview_like: { count: 99 } }), 99);
});

test('extractLikeCount: zero is preserved (not coerced to null)', () => {
  assert.equal(extractLikeCount({ like_count: 0 }), 0);
});

test('buildContext: returns null when no shortcode is present', () => {
  assert.equal(buildContext({}), null);
});

test('buildContext: assembles full context from REST shape', () => {
  const ctx = buildContext({
    code: 'Cabc123',
    caption: { text: 'a #cool post' },
    user: { username: 'creator' },
    taken_at: 1704067200,
    like_count: 7
  });
  // Cross-realm objects don't satisfy deepEqual's prototype check; compare
  // field-by-field instead.
  assert.equal(ctx.postShortcode, 'Cabc123');
  assert.equal(ctx.caption, 'a #cool post');
  assert.equal(ctx.owner, 'creator');
  assert.equal(ctx.takenAt, '2024-01-01T00:00:00.000Z');
  assert.equal(ctx.likeCount, 7);
  assert.equal(ctx.carouselSize, 1);
  assert.equal(ctx.carouselIndex, null);
});

test('buildContext: detects carouselSize from carousel_media', () => {
  const ctx = buildContext({
    code: 'Cabc',
    carousel_media: [{}, {}, {}, {}]
  });
  assert.equal(ctx.carouselSize, 4);
});

test('buildContext: detects carouselSize from edge_sidecar_to_children', () => {
  const ctx = buildContext({
    shortcode: 'CXYZ',
    edge_sidecar_to_children: { edges: [{}, {}] }
  });
  assert.equal(ctx.carouselSize, 2);
});

test('extractMediaFromData: single image with metadata', () => {
  const result = extractMediaFromData({
    code: 'Cimg1',
    media_type: 1,
    user: { username: 'imgowner' },
    taken_at: 1704067200,
    image_versions2: { candidates: [{ url: 'https://cdn/img.jpg' }] }
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'image');
  assert.equal(result[0].url, 'https://cdn/img.jpg');
  assert.equal(result[0].context.postShortcode, 'Cimg1');
  assert.equal(result[0].context.owner, 'imgowner');
});

test('extractMediaFromData: single video with metadata', () => {
  const result = extractMediaFromData({
    code: 'Cvid1',
    media_type: 2,
    caption: { text: 'a video' },
    video_versions: [{ url: 'https://cdn/v.mp4' }],
    image_versions2: { candidates: [{ url: 'https://cdn/poster.jpg' }] }
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'video');
  assert.equal(result[0].url, 'https://cdn/v.mp4');
  assert.equal(result[0].thumbnail, 'https://cdn/poster.jpg');
  assert.equal(result[0].context.caption, 'a video');
});

test('extractMediaFromData: REST carousel propagates parent metadata + per-slide index', () => {
  const result = extractMediaFromData({
    code: 'Ccarousel',
    media_type: 8,
    user: { username: 'creator' },
    caption: { text: 'album time' },
    carousel_media: [
      { media_type: 1, image_versions2: { candidates: [{ url: 'https://cdn/1.jpg' }] } },
      { media_type: 1, image_versions2: { candidates: [{ url: 'https://cdn/2.jpg' }] } },
      { media_type: 2, video_versions: [{ url: 'https://cdn/3.mp4' }], image_versions2: { candidates: [{ url: 'https://cdn/3.jpg' }] } }
    ]
  });
  assert.equal(result.length, 3);
  // All slides share the parent's shortcode/owner/caption
  for (const r of result) {
    assert.equal(r.context.postShortcode, 'Ccarousel');
    assert.equal(r.context.owner, 'creator');
    assert.equal(r.context.caption, 'album time');
    assert.equal(r.context.carouselSize, 3);
  }
  // carouselIndex is 0-based and increments
  assert.equal(result[0].context.carouselIndex, 0);
  assert.equal(result[1].context.carouselIndex, 1);
  assert.equal(result[2].context.carouselIndex, 2);
  // Types match
  assert.equal(result[0].type, 'image');
  assert.equal(result[1].type, 'image');
  assert.equal(result[2].type, 'video');
});

test('extractMediaFromData: GraphQL sidecar carousel propagates context + index', () => {
  const result = extractMediaFromData({
    shortcode: 'Csidecar',
    user: { username: 'g' },
    edge_sidecar_to_children: {
      edges: [
        { node: { media_type: 1, image_versions2: { candidates: [{ url: 'https://cdn/a.jpg' }] } } },
        { node: { media_type: 1, image_versions2: { candidates: [{ url: 'https://cdn/b.jpg' }] } } }
      ]
    }
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].context.postShortcode, 'Csidecar');
  assert.equal(result[0].context.carouselIndex, 0);
  assert.equal(result[1].context.carouselIndex, 1);
});

test('extractMediaFromData: feed.items[] yields one entry per post with own context', () => {
  const result = extractMediaFromData({
    items: [
      { code: 'C1', media_type: 1, image_versions2: { candidates: [{ url: 'https://cdn/1.jpg' }] }, user: { username: 'u1' } },
      { code: 'C2', media_type: 1, image_versions2: { candidates: [{ url: 'https://cdn/2.jpg' }] }, user: { username: 'u2' } }
    ]
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].context.postShortcode, 'C1');
  assert.equal(result[0].context.owner, 'u1');
  assert.equal(result[1].context.postShortcode, 'C2');
  assert.equal(result[1].context.owner, 'u2');
});

test('extractMediaFromData: depth limit prevents runaway recursion on cyclic data', () => {
  const cyclic = { foo: {} };
  cyclic.foo.bar = cyclic;
  // Should not throw / not infinite-loop
  const result = extractMediaFromData(cyclic);
  assert.ok(Array.isArray(result));
});

test('extractMediaFromData: data with no media returns []', () => {
  assert.equal(extractMediaFromData({ unrelated: 'json' }).length, 0);
  assert.equal(extractMediaFromData(null).length, 0);
  assert.equal(extractMediaFromData('string').length, 0);
});

test('extractMediaFromData: context survives a level of irrelevant nesting', () => {
  // Realistic: API wraps the post inside an envelope.
  const result = extractMediaFromData({
    status: 'ok',
    data: {
      shortcode_media: {
        shortcode: 'Cnested',
        media_type: 1,
        image_versions2: { candidates: [{ url: 'https://cdn/n.jpg' }] },
        owner: { username: 'nestedowner' }
      }
    }
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].context.postShortcode, 'Cnested');
  assert.equal(result[0].context.owner, 'nestedowner');
});
