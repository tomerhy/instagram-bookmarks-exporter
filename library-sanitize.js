/**
 * Authoritative library sanitiser — the single place a stored record is made
 * safe, wherever it came from.
 *
 * Why this file exists (4.4.2):
 * ----------------------------
 * 4.4.1 validated URLs on the way IN — at capture, and at import. That was not
 * enough. A user upgrading from 4.4.0 or earlier already has records in
 * chrome.storage.local that were never validated by anything, because neither
 * capture nor import checked URLs before 4.4.1. Those records were loaded
 * straight into the gallery and reached every URL sink it has: img.src,
 * video.src, innerHTML, window.open, fetch, the clipboard, and the JSON/CSV
 * exports.
 *
 * So sanitisation now happens at the boundary where data ENTERS THE PROCESS,
 * not only where it enters storage:
 *
 *   - gallery.js  initial chrome.storage.local load
 *   - gallery.js  chrome.storage.onChanged payloads
 *   - gallery.js  imported JSON and imported legacy URL lists
 *   - content.js  loadFromStorage(), so a legacy record can never be
 *                 re-persisted by a later saveToStorage()
 *
 * Rendering still validates again at every sink (see safeMediaUrl /
 * safePostUrl in gallery.js). That duplication is deliberate: this file must
 * not become a single point of failure whose bypass re-exposes every sink.
 *
 * Contract
 * --------
 * Every record is rebuilt field by field. Nothing is copied wholesale, so a
 * stored object carrying extra properties (innerHTML, onclick, srcdoc, __proto__
 * …) cannot smuggle them through. A record is KEPT if it has either an
 * allowlisted media URL or an allowlisted post URL; an invalid *optional* field
 * is nulled rather than causing the whole record to be dropped.
 *
 * Exposed as globalThis.SBE_LIB. Depends on url-allowlist.js (globalThis.SBE_URL)
 * being loaded first.
 */
(function () {
  'use strict';

  var LIMITS = {
    recordsPerBucket: 20000,  // hard ceiling per images/videos list
    caption: 2200,            // Instagram's own caption limit
    owner: 30,                // Instagram's own username limit
    shortcode: 64,
    hashtag: 140,
    hashtags: 60,
    carouselSize: 50,
    timestamp: 40
  };

  function api() {
    return globalThis.SBE_URL || null;
  }

  // Fail closed: with no allowlist loaded, nothing is allowed through.
  function isMedia(value) {
    var a = api();
    if (!a || typeof a.isAllowedMediaUrl !== 'function') return false;
    try { return a.isAllowedMediaUrl(value); } catch (_) { return false; }
  }

  function isPost(value) {
    var a = api();
    if (!a || typeof a.isAllowedPostUrl !== 'function') return false;
    try { return a.isAllowedPostUrl(value); } catch (_) { return false; }
  }

  function cleanString(value, max) {
    if (typeof value !== 'string') return null;
    var out = value.slice(0, max);
    return out.length ? out : null;
  }

  function cleanOwner(value) {
    var owner = cleanString(value, LIMITS.owner);
    if (!owner) return null;
    return /^[A-Za-z0-9._]+$/.test(owner) ? owner : null;
  }

  function cleanShortcode(value) {
    var code = cleanString(value, LIMITS.shortcode);
    if (!code) return null;
    return /^[A-Za-z0-9_-]+$/.test(code) ? code : null;
  }

  function cleanTimestamp(value) {
    var raw = cleanString(value, LIMITS.timestamp);
    if (!raw) return null;
    return isNaN(Date.parse(raw)) ? null : raw;
  }

  function cleanCount(value) {
    if (typeof value !== 'number' || !isFinite(value) || value < 0) return null;
    return Math.floor(value);
  }

  function cleanIndex(value, maxExclusive) {
    if (typeof value !== 'number' || !isFinite(value)) return null;
    var n = Math.floor(value);
    return (n >= 0 && n < maxExclusive) ? n : null;
  }

  function cleanHashtags(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    for (var i = 0; i < value.length && out.length < LIMITS.hashtags; i++) {
      var tag = cleanString(value[i], LIMITS.hashtag);
      // A hashtag is a word, not markup. Anything else is dropped silently.
      if (tag && /^[\p{L}\p{N}_]+$/u.test(tag)) out.push(tag);
    }
    return out;
  }

  function cleanMetadata(raw, tally) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    var caption = cleanString(raw.caption, LIMITS.caption);
    var owner = cleanOwner(raw.owner);
    var takenAt = cleanTimestamp(raw.takenAt);
    var likeCount = cleanCount(raw.likeCount);
    var hashtags = cleanHashtags(raw.hashtags);

    if (raw.caption != null && caption === null) tally.fields++;
    if (raw.owner != null && owner === null) tally.fields++;
    if (raw.takenAt != null && takenAt === null) tally.fields++;
    if (raw.likeCount != null && likeCount === null) tally.fields++;
    if (Array.isArray(raw.hashtags) && hashtags.length !== raw.hashtags.length) tally.fields++;

    if (caption === null && owner === null && takenAt === null &&
        likeCount === null && !hashtags.length) {
      return null;
    }
    return {
      caption: caption,
      owner: owner,
      takenAt: takenAt,
      likeCount: likeCount,
      hashtags: hashtags
    };
  }

  /**
   * Rebuild one record. Returns null when the record cannot be made safe.
   *
   * Keep rule: a record survives if it has an allowlisted media URL OR an
   * allowlisted post URL. The second case matters — a video whose CDN URL has
   * expired but which still has a good permalink is a record the user wants
   * kept, so it is preserved with url:null and remains openable.
   *
   * tally accumulates {records, fields} so callers can tell the user what was
   * discarded.
   */
  function sanitizeRecord(raw, fallbackType, tally) {
    tally = tally || { records: 0, fields: 0 };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      tally.records++;
      return null;
    }

    var url = isMedia(raw.url) ? raw.url : null;
    var thumbnail = isMedia(raw.thumbnail) ? raw.thumbnail : null;
    var postUrl = isPost(raw.postUrl) ? raw.postUrl : null;

    // Count each rejected-but-present URL as a removed field.
    if (raw.url != null && url === null) tally.fields++;
    if (raw.thumbnail != null && thumbnail === null) tally.fields++;
    if (raw.postUrl != null && postUrl === null) tally.fields++;

    if (!url && !thumbnail && !postUrl) {
      tally.records++;
      return null;
    }

    var type = (raw.type === 'image' || raw.type === 'video')
      ? raw.type
      : (fallbackType === 'video' ? 'video' : 'image');

    var shortcode = cleanShortcode(raw.postShortcode);
    if (raw.postShortcode != null && shortcode === null) tally.fields++;

    var carouselSize = cleanIndex(raw.carouselSize, LIMITS.carouselSize + 1);
    if (!carouselSize || carouselSize < 1) carouselSize = 1;

    var scrapedAt = cleanTimestamp(raw.scrapedAt);
    if (raw.scrapedAt != null && scrapedAt === null) tally.fields++;

    // A media URL is required for the primary `url` field; when only a
    // permalink survived, url stays null and the record is post-only.
    return {
      type: type,
      url: url || thumbnail || null,
      thumbnail: thumbnail || url || null,
      postUrl: postUrl,
      postShortcode: shortcode,
      carouselIndex: cleanIndex(raw.carouselIndex, LIMITS.carouselSize),
      carouselSize: carouselSize,
      metadata: cleanMetadata(raw.metadata, tally),
      scrapedAt: scrapedAt
    };
  }

  function sanitizeList(list, fallbackType, tally) {
    tally = tally || { records: 0, fields: 0 };
    if (!Array.isArray(list)) return [];
    var capped = list.slice(0, LIMITS.recordsPerBucket);
    if (list.length > capped.length) tally.records += list.length - capped.length;
    var out = [];
    for (var i = 0; i < capped.length; i++) {
      var rec = sanitizeRecord(capped[i], fallbackType, tally);
      if (rec) out.push(rec);
    }
    return out;
  }

  // Canonical serialisation of a record, used only to decide whether
  // sanitisation actually altered anything.
  //
  // Why not compare the tally? Because the tally counts *rejections*, and a
  // record can be rebuilt differently without any rejection being counted:
  // an unknown `innerHTML` / `onclick` / `srcdoc` / `style` property is
  // dropped simply by not being copied, a bad `type` is normalised, a negative
  // `carouselSize` becomes 1, an over-long caption is truncated, extra
  // metadata keys disappear. In every one of those cases the in-memory object
  // was safe but storage still held the unsafe original — and with a
  // tally-only test, `changed` was false, so `persist` never fired and the
  // claim that unsafe legacy values are permanently removed was untrue.
  //
  // Keys are emitted in a FIXED order, so this never reports a difference
  // merely because two objects enumerate their properties differently. That
  // matters: an ordering-sensitive comparison would rewrite storage on every
  // single load, forever.
  var RECORD_KEYS = ['type', 'url', 'thumbnail', 'postUrl', 'postShortcode',
                     'carouselIndex', 'carouselSize', 'scrapedAt'];
  var META_KEYS = ['caption', 'owner', 'takenAt', 'likeCount', 'hashtags'];

  function canonicalRecord(rec) {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      // A non-record canonicalises to a marker that cannot collide with a
      // real record, so junk in never compares equal to anything out.
      return '\u0000nonrecord:' + Object.prototype.toString.call(rec) +
             ':' + String(rec);
    }
    var parts = [];
    for (var i = 0; i < RECORD_KEYS.length; i++) {
      var k = RECORD_KEYS[i];
      var v = rec[k];
      parts.push(k + '=' + (v === undefined || v === null ? '\u0000' : String(v)));
    }
    var meta = rec.metadata;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      parts.push('metadata=\u0000' +
        (meta === undefined || meta === null ? '' : String(meta)));
    } else {
      for (var j = 0; j < META_KEYS.length; j++) {
        var mk = META_KEYS[j];
        var mv = meta[mk];
        if (mk === 'hashtags') {
          parts.push('metadata.hashtags=' +
            (Array.isArray(mv) ? mv.join('\u0001') : '\u0000' + String(mv)));
        } else {
          parts.push('metadata.' + mk + '=' +
            (mv === undefined || mv === null ? '\u0000' : String(mv)));
        }
      }
      // Any metadata key we do NOT carry over is itself a change.
      var extraMeta = Object.keys(meta).filter(function (k2) {
        return META_KEYS.indexOf(k2) === -1;
      }).sort();
      if (extraMeta.length) parts.push('metadata.extra=' + extraMeta.join(','));
    }
    // Any top-level key we do NOT carry over is a change — this is what
    // catches innerHTML / onclick / srcdoc / style and anything like them.
    var extra = Object.keys(rec).filter(function (k3) {
      return RECORD_KEYS.indexOf(k3) === -1 && k3 !== 'metadata';
    }).sort();
    if (extra.length) parts.push('extra=' + extra.join(','));
    return parts.join('\u0002');
  }

  function canonicalList(list) {
    if (!Array.isArray(list)) return '\u0000notalist:' + String(list);
    return list.map(canonicalRecord).join('\u0003');
  }

  /**
   * Sanitise a whole {images, videos} library.
   *
   * Returns { images, videos, removedRecords, removedFields, changed }.
   *
   * `changed` is true when the sanitised output differs from the input in ANY
   * way — a dropped record, a nulled field, a removed unknown property, a
   * normalised number, a truncated string. Callers use it to decide whether to
   * write the cleaned library back.
   *
   * Idempotence, and therefore the absence of a storage feedback loop, follows
   * from sanitizeRecord being a fixed point: sanitising already-sanitised
   * output reproduces it exactly, so the canonical forms match and `changed` is
   * false. `tests/legacy-storage.test.js` asserts that directly.
   */
  function sanitizeLibrary(data) {
    var tally = { records: 0, fields: 0 };
    var src = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
    var images = sanitizeList(src.images, 'image', tally);
    var videos = sanitizeList(src.videos, 'video', tally);

    // Compare canonical forms rather than trusting the rejection tally.
    var inImages = Array.isArray(src.images) ? src.images : [];
    var inVideos = Array.isArray(src.videos) ? src.videos : [];
    var shapeChanged =
      canonicalList(inImages) !== canonicalList(images) ||
      canonicalList(inVideos) !== canonicalList(videos);

    return {
      images: images,
      videos: videos,
      removedRecords: tally.records,
      removedFields: tally.fields,
      changed: shapeChanged || tally.records > 0 || tally.fields > 0
    };
  }

  // Human-readable summary for the gallery status line (Phase 2 requirement 12).
  function describeRemoval(result) {
    if (!result || !result.changed) return '';
    var parts = [];
    if (result.removedRecords) {
      parts.push(result.removedRecords +
        (result.removedRecords === 1 ? ' unsafe record' : ' unsafe records'));
    }
    if (result.removedFields) {
      parts.push(result.removedFields +
        (result.removedFields === 1 ? ' invalid field' : ' invalid fields'));
    }
    if (!parts.length) return '';
    return 'Removed ' + parts.join(' and ') + ' from older captured data';
  }

  var exported = {
    sanitizeRecord: sanitizeRecord,
    sanitizeList: sanitizeList,
    sanitizeLibrary: sanitizeLibrary,
    describeRemoval: describeRemoval,
    canonicalRecord: canonicalRecord,
    canonicalList: canonicalList,
    LIMITS: LIMITS
  };

  globalThis.SBE_LIB = exported;

  if (globalThis.__SBE_TEST_HOOKS__) {
    globalThis.__SBE_TEST_HOOKS__['library-sanitize'] = exported;
  }
})();
