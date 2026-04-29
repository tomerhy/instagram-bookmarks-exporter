# Tech Debt

Snapshot at v4.2.3, amended after v4.3 shipped. Items are concrete and verified against the code (file:line shown). Ranked by impact, not by effort. Use this as the input list when planning each release — pick which items each release pays down, don't try to clear it all at once.

> **Status**: items 1–5 shipped in **v4.3.0** (released as `8913c19`, tag `v4.3.0`). Remaining items are mapped to v4.4 and beyond in the "Summary by release" section at the bottom.

Effort scale: **S** = under an hour, **M** = half a day, **L** = a day or more.

---

## High — actively hurts users or the store listing

### 1. Autoplay is promised in the listing but not loaded — DECISION: ship it

`manifest.json:5` says *"Now with video auto-play!"*. The implementation lives in `autoplay.js` (~570 lines, IntersectionObserver + MutationObserver, mute default, user-pref persistence) but the file is **not** in `manifest.json`'s `content_scripts` array. **This is a retention-critical feature for the user base — ship it in v4.3.**

What "shipping" means concretely:
- Add `autoplay.js` to `content_scripts` (same `matches` as `content.js`, `run_at: document_idle`, isolated world — it uses no `chrome.*` APIs so MAIN world also works).
- Verify it doesn't fight the auto-scroll capture loop in `content.js`. Both run on the saved-posts grid; autoplay manipulates `<video>` elements, scroll-capture moves the viewport — they shouldn't interact, but worth a deliberate test.
- Confirm muted-by-default (browser autoplay policy) is the actual behavior on a fresh install, not just in code defaults.
- Surface a toggle in `popup.html` since `autoplay.js` already supports user-pref persistence (`CONFIG.defaultEnabled` / `defaultMuted`). Without a UI toggle, users who don't want it can't disable it.
- QA on three surfaces: saved-posts grid, individual post page, reels feed.

Effort: **M**. The wiring is **S**, but the toggle UI + cross-surface QA pushes it up.

### 2. Carousels lose grouping in storage

`parseApiResponse` (`content.js:921`) walks `carousel_media` and pushes each child into `state.images` / `state.videos` independently. The shortcode is preserved per item via `postUrl`, but there is no parent-child relationship, no "this is slide 3 of 7," no album. The gallery shows a flat soup. **This blocks the single highest-leverage feature** (album/ZIP download per post) that competitors charge for.

- **Fix sketch**: add `postShortcode` and `carouselIndex` fields to each item; introduce a derived `getPostsGrouped()` view in `gallery.js` that buckets items by `postShortcode`. Storage shape is forward-compatible — old items just have `null` for the new fields. Effort: **M**.

### 3. Post metadata is parsed from the API and thrown away

The parser already touches `code`, `caption`, `taken_at`, `user.username`, `like_count` in the response payloads (see `parseApiResponse` and `parseMedia` at `content.js:927`). None of it is persisted. Capturing it unlocks: search by caption, sort by date, CSV export, owner-grouped folders, dedup-by-shortcode. **Most "Pro" features in competitor extensions are just metadata.**

- **Fix sketch**: extend the item shape to `{ ..., metadata: { caption, owner, takenAt, hashtags, likeCount } }`. `addImage` / `addVideo` take an optional metadata arg. Hashtags can be derived from caption regex. Effort: **M**.

### 4. `build.sh` produces a broken zip

Omits `injector.js`, `content-styles.css`, and `analytics.js` (`build.sh:13-21`). The manifest references all three; the zip will load but capture nothing and have no styles or analytics. Already documented in `CLAUDE.md` but unfixed.

- **Fix**: add the three `cp` lines. Effort: **S**.

---

## Medium — slows future work, signals neglect

### 5. `state.carousels` is vestigial

Defined (`content.js:61`), zeroed (`content.js:1438, 1572`), persisted (`content.js:1486`), restored (`content.js:1504`), reported in stats (`content.js:1535-1536, 1550-1551`) — and **never written to**. The carousels-as-grouping concept that originally lived here is what item #2 above will solve. Either repurpose this field for the grouped-post structure or remove it.

- **Fix**: tied to #2. Either becomes the home for `state.posts` (grouped) or deleted.

### 6. Legacy `imageUrls` / `videoUrls` storage keys

`gallery.js:316-322` reads them as a compat fallback. `background.js:15, 21` includes them in `GET_DATA`/`CLEAR_DATA`. `content.js:1578-1579` clears them. **Nothing in this codebase writes them.** They were the v1/v2 storage shape; users still on those versions would benefit from the fallback, but v4.2.3 has been live since Feb so the upgrade window has passed.

- **Fix**: remove the fallback in `gallery.js`, drop the keys from `background.js` and the `CLEAR` handler. Effort: **S**.

### 7. `scanDom()` is dead code

Defined at `content.js:1178` (~100 lines). Only called from the `SCAN` message handler at `content.js:1542`. No file in the repo sends a `SCAN` message. The capture pipeline now relies entirely on `injector.js` API interception + `parseApiResponse`. The DOM-scan was the original v1 mechanism.

- **Fix**: delete `scanDom()` and the `SCAN` handler. Effort: **S**.

### 8. Redundant fetch/XHR interception in `content.js`

`injector.js` (MAIN world) hooks `fetch`/XHR at `document_start`, parses responses, and posts media to `content.js`. `content.js:1080-1172` *also* hooks `fetch`/XHR (isolated world) and runs `parseApiResponse` on the same responses. The isolated-world hooks pre-date the injector and are now a redundant safety net at best, dead code at worst — Instagram's page-side fetch happens in the page world, so the isolated-world hook only ever sees fetches initiated by *other* extensions or by `content.js` itself.

- **Fix**: remove the duplicate hooks and `parseApiResponse` from `content.js`. Verify with logging that the injector covers all current capture cases first. Effort: **M** (mostly verification).

### 9. `markCarouselForCapture` / `fetchedCarousels` dedup is purely cosmetic

`fetchedCarousels` set (`content.js:464`) and `markCarouselForCapture` (`content.js:468`) only suppress duplicate console logs. The function does no actual work. Dead alongside #8.

- **Fix**: delete both. Effort: **S**.

### 10. Disabled CLICK-BASED CAPTURE block

40-line `/* ... END OF CLICK-BASED CAPTURE */` comment in `content.js` (around `:727-773`). `CLAUDE.md` flags this as intentional reference. If you decide it's not coming back, deleting it is fair game; if it might revive for stories/reels later, leave it.

- **Fix**: judgment call. Decide and either delete or move to a `docs/` snippet. Effort: **S**.

---

## Low — cleanliness, not urgent

### 11. Six icon-generation utilities for one task

`create-icons.html`, `convert-icons.html`, `convert_icons.py`, `create_icons.py`, `create_clean_icons.py`, `generate-icons.sh`. The README points users at `create-icons.html` only. The icon PNGs in `assets/icons/` are committed and rarely change. Pick one, delete the rest.

- **Fix**: keep `create-icons.html`, delete the other five. Effort: **S**.

### 12. `create_screenshots.py` is a one-off tool in the repo root

Likely used once to generate Chrome Web Store listing screenshots. Either move to `tools/` or remove if the source assets are elsewhere.

- **Fix**: judgment call. Effort: **S**.

### 13. `gallery.js` uses `var` (84 instances) while the rest of the codebase uses `const`/`let`

Cosmetic but it's the file most likely to grow next (Phase 1 features land here). Modernizing now is cheaper than later. No behavior change risk if done with care (block-scope for `let`, no re-declaration).

- **Fix**: targeted refactor. Effort: **M**.

### 14. Manifest description rot risk

`manifest.json:5` description is the marketing surface. After the autoplay claim is resolved (#1), establish a checklist: when this string changes, also update README and the Chrome Web Store listing copy. Not a code change — a process note, but worth flagging since #1 is exactly this kind of drift.

---

## Summary by release

A reasonable mapping for planning purposes — not a commitment:

- **v4.3 (cleanup + groundwork)** ✅ **SHIPPED**: items 1, 2, 3, 4, 5. One coherent "Album mode" release. Set the stage for every Phase 1 feature. Released `8913c19`, tag `v4.3.0`.
- **v4.4 (consolidation + first Phase 1 feature)**: items 6, 7, 8, 9 (cleanup) plus item 15 (search by caption/hashtag/username — the first user-visible payoff of v4.3's metadata pipeline). Window: 4–6 weeks after v4.3.
- **Anytime**: 10, 11, 12, 13. Bundle into a release whenever you're touching the same files for other reasons.

---

## Phase 1 features — candidates for v4.5+

Enabled by the v4.3 metadata pipeline. Pick one per release; do **not** ship more than one feature in a single release while the codebase has no automated browser tests.

### 15. Search captured posts by caption / hashtag / username — **planned for v4.4**

Items now carry `metadata.caption`, `metadata.owner`, and `metadata.hashtags`. A simple search box at the top of the gallery that filters the current tab by substring match against caption + owner + hashtag would expose all of that immediately.

- **Fix sketch**: text input in `gallery.html`, debounced `oninput` handler in `gallery.js` that filters `getCurrentItems()` results before pagination. Match against `(item.metadata?.caption || '') + ' ' + (item.metadata?.owner || '') + ' ' + (item.metadata?.hashtags || []).join(' ')`, case-insensitive. Empty input = no filter. Effort: **S**.
- Track usage with `Analytics.trackFeature('gallery_search', { query_length, match_count })` so you can see if it's used.

### 16. Sort gallery by date / owner / like count

Drop-down next to the search box. Default stays "capture order." Sort keys are `metadata.takenAt`, `metadata.owner` (alphabetical), `metadata.likeCount`. Items lacking the field sort last.

- Effort: **S**.

### 17. CSV / JSON export of captured items with metadata

Power users have already asked for this implicitly via the `export_urls` feature. With v4.3 metadata, a richer export becomes possible: shortcode, owner, date, caption, like count, post URL, media URL.

- **Fix sketch**: new buttons `Export CSV` / `Export JSON` next to the existing `Export URLs`. Generate the file in-memory, trigger download via blob URL.
- Effort: **S** for JSON, **S** for CSV (escape commas/quotes/newlines in captions carefully).

### 18. Per-post ZIP download (album bundle)

For carousel posts: download all slides + a `metadata.json` as a single zip named `<shortcode>.zip`. Requires bringing in JSZip (~30KB) — the only real npm dep this project would have.

- Effort: **M**. The zipping itself is small; the cost is bundling JSZip into the build (without a bundler) and adding `web_accessible_resources` if needed.

### 19. Owner-grouped folders in batch downloads

When downloading multiple items, group them into per-owner folders inside a single zip. Builds on #18.

- Effort: **S** once #18 lands. Bundle into a release whenever you're touching the same files for other reasons.
