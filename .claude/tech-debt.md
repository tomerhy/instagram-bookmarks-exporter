# Tech Debt

Snapshot at v4.2.3, amended after v4.3 shipped, amended again at v4.3.10. Items are concrete and verified against the code (file:line shown). Ranked by impact, not by effort. Use this as the input list when planning each release — pick which items each release pays down, don't try to clear it all at once.

> **Status (v4.3.10)**:
> - Items **1–5** shipped in **v4.3.0** (`8913c19`).
> - Item **15** (search) shipped in **v4.3.9**, way earlier than planned.
> - Item **17** (rich export) shipped *in part* — JSON export with full metadata landed in **v4.3.6**; CSV export is still pending.
> - Item **12** (`create_screenshots.py` one-off tool) shipped — deleted and replaced by `compose_screenshots.py`.
> - Items **6, 7, 8, 9** remain — the v4.4.0 "consolidation cleanup" release is still pending.
> - The v4.3.1–4.3.10 sprint also shipped a large amount of UX work that wasn't on the roadmap (premium UI redesign, popup overhaul, carousel inline drawer, notification-style toolbar badge, extension-context guards, gallery Clear viewer reset, easter egg). See "What shipped in v4.3.1–4.3.10" below.

Effort scale: **S** = under an hour, **M** = half a day, **L** = a day or more.

---

## What shipped in v4.3.1–4.3.10 (mostly not on the original plan)

| Version | What                                                                                              | Plan slot |
|---------|---------------------------------------------------------------------------------------------------|-----------|
| 4.3.1   | Toolbar badge as a **notification** (unseen since last visit) instead of total count              | new       |
| 4.3.2   | Premium UI redesign — aurora atmosphere, glassmorphism, spring motion, WCAG AA contrast, a11y     | new       |
| 4.3.3   | Popup overhaul — stat-tile `+N new` delta, refined typography, Clear confirmation                  | new       |
| 4.3.5   | Gallery Clear now resets viewer (video stopped, meta strip cleared, slideshow halted) + confirms  | bug       |
| 4.3.6   | Full-fidelity **JSON Export/Import** with metadata round-trip; backward-compatible `.txt` import   | item 17a  |
| 4.3.7   | Extension-context guards (`safeStorageSet` / `safeStorageGet` / `safeSendMessage`)                | new       |
| 4.3.8   | **Carousel inline drawer** — click album badge to expand all slides in a glass drawer             | new       |
| 4.3.9   | **Gallery search** — filter by `@owner`, `#tag`, or caption (live, debounced, AND tokens)         | item 15   |
| 4.3.10  | Easter egg — click the popup logo for the maker's contact card                                    | new       |

Test count grew from ~50 (pre-sprint) to **177** across the period. Every shipped feature has unit-test coverage where applicable.

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

### 12. `create_screenshots.py` is a one-off tool in the repo root — ✅ **SHIPPED in v4.3.10**

Replaced by `compose_screenshots.py` (real captures of the running extension framed into 1280×800 store screenshots). Raw captures go in `assets/screenshots/raw/` (gitignored); composed PNGs in `assets/screenshots/`. Old `create_screenshots.py` (PIL mockup approach with hardcoded v4.1.0 strings and pre-redesign UI) deleted.

### 13a. Design tokens duplicated between `popup.html` and `gallery.html` — **surfaced during v4.3.2**

Both files now share a near-identical `:root` block — `--ig-pink`, `--selected`, `--surface-*`, `--space-*`, `--radius-*`, `--btn-h-*`, `--t-fast` / `--t-base` / `--t-spring`, etc. They were intentionally duplicated during the v4.3.2 redesign with "keep in sync with gallery.html" comments. Future cleanup: extract to a shared `tokens.css`, `<link>`ed from both popup and gallery HTML. Caveat: needs `web_accessible_resources` only if a content script also needed it (it doesn't). Build.sh would need to copy the new file too.

- **Effort**: **S**. Risk: low — both surfaces are extension pages, no MV3 CSP issues. Worth doing once a third surface ever needs the same tokens.

### 13b. Popup buttons still use emoji icons while the gallery uses inline SVGs — **inconsistency from v4.3.8**

Gallery received a full SVG-symbol system in v4.3.8 (`#i-maximize`, `#i-x`, `#i-chevron-left/right`, `#i-stack`, `#i-search`). Popup buttons still use emoji as icon glyphs (🎠 Capture, 🖼️ Gallery, 🗑️ Clear all, 🎬 Auto-play, ☕ Buy me a coffee). Each is wrapped in `<span class="emoji" aria-hidden="true">` so screen readers ignore them, but visually they're inconsistent with the gallery's Lucide-line icons and platform-dependent in rendering.

- **Fix sketch**: define the same `<svg><symbol>` set in `popup.html` (or, if 13a lands, share via a partial). Replace emojis with `<svg><use href="#i-…"/></svg>`. Effort: **S**. Won't change behavior, only visual consistency.

### 13. `gallery.js` uses `var` (84 instances) while the rest of the codebase uses `const`/`let`

Cosmetic but it's the file most likely to grow next (Phase 1 features land here). Modernizing now is cheaper than later. No behavior change risk if done with care (block-scope for `let`, no re-declaration).

- **Fix**: targeted refactor. Effort: **M**.

### 14. Manifest description rot risk

`manifest.json:5` description is the marketing surface. After the autoplay claim is resolved (#1), establish a checklist: when this string changes, also update README and the Chrome Web Store listing copy. Not a code change — a process note, but worth flagging since #1 is exactly this kind of drift.

---

## Summary by release

A reasonable mapping for planning purposes — not a commitment:

- **v4.3.0 (cleanup + groundwork)** ✅ **SHIPPED**: items 1, 2, 3, 4, 5. Set the stage for every Phase 1 feature. Released `8913c19`, tag `v4.3.0`.
- **v4.3.1–4.3.10 (the polish/feature sprint)** ✅ **SHIPPED**: see the table at the top. Items 12, 15, 17a moved into this window; the rest of the sprint shipped UX/UI work not originally on the plan. Tests grew 50 → 177.
- **v4.4.0 (consolidation cleanup)** — still pending: items 6, 7, 8, 9. **No new features.** Validate against the manual QA checklist; this is the natural freeze point before graduating to automated tests per item 21.
- **v4.5+ (more Phase 1 features)**: items 13a (shared tokens), 13b (popup SVG icons), 16 (sort), 17b (CSV export), 18 (per-post zip), 19 (owner-grouped folders), 20 (createPanel decision).
- **Anytime**: 10, 11, 13. Bundle into a release whenever you're touching the same files for other reasons.

---

## Phase 1 features — candidates for v4.5+

Enabled by the v4.3 metadata pipeline. Pick one per release; do **not** ship more than one feature in a single release while the codebase has no automated browser tests.

### 15. Search captured posts by caption / hashtag / username — ✅ **SHIPPED in v4.3.9**

Glass search box in the gallery toolbar with **token-modifier grammar**: bare words match across owner/caption/hashtags; `@user` matches owner only; `#tag` matches hashtags only; multiple tokens AND together. 150ms debounce, Esc clears, Clear button + result-count meta row, distinct "no matches" empty state. `matchesQuery()` is pinned by 17 tests in `tests/search.test.js`.

Analytics: `gallery_search { query_length, has_token_modifier }` fires per query.

### 16. Sort gallery by date / owner / like count

Drop-down next to the search box. Default stays "capture order." Sort keys are `metadata.takenAt`, `metadata.owner` (alphabetical), `metadata.likeCount`. Items lacking the field sort last.

- Effort: **S**.

### 17. CSV / JSON export of captured items with metadata — 🟡 **PARTIAL: JSON shipped in v4.3.6, CSV pending**

JSON path landed in v4.3.6 as a full backup format:

```json
{ "format": "instagram-saved-media-exporter", "formatVersion": 1,
  "extensionVersion": "4.3.6", "exportedAt": "...",
  "images": [...], "videos": [...] }
```

Round-trip preserves all metadata (owner, caption, hashtags, scrapedAt, carouselSize, postUrl). The existing Export button became **Export All** (writes JSON for both tabs); Import auto-detects JSON vs legacy `.txt` URL list and surfaces a status message indicating which format was loaded. Pinned by 17 tests in `tests/export-import.test.js`.

**CSV still pending** for v4.5+. CSV is the harder format — the metadata.caption field carries newlines, commas, and quotes that need RFC 4180 escaping. Effort: **S** when picked up.

### 18. Per-post ZIP download (album bundle)

For carousel posts: download all slides + a `metadata.json` as a single zip named `<shortcode>.zip`. Requires bringing in JSZip (~30KB) — the only real npm dep this project would have.

- Effort: **M**. The zipping itself is small; the cost is bundling JSZip into the build (without a bundler) and adding `web_accessible_resources` if needed.

### 19. Owner-grouped folders in batch downloads

When downloading multiple items, group them into per-owner folders inside a single zip. Builds on #18.

- Effort: **S** once #18 lands. Bundle into a release whenever you're touching the same files for other reasons.

### 20. `createPanel()` is dead code (~160 lines)

`createPanel()` at `content.js:1319` defines a floating in-page panel (header, stats, "Start Capture" button, "Gallery" button, "Clear" button, status row, loading bar) plus its `<style>` block. **It is never called anywhere in the repo.** Consequences:

- `updatePanel()` (`content.js:1480`) is a silent no-op in production — the elements it targets (`#ig-exp-images`, `#ig-exp-videos`) never exist.
- `setStatus()` (`content.js:1491`) is also a no-op — `#ig-exp-status` and `#ig-exp-loading-bar` never exist.
- Every `setStatus(...)` call across the capture loop is wasted work that produces zero user-visible output. The popup is the only real UI surface.

This is the largest single block of dead UI code in the repo. Either:
- **Delete it** — `createPanel`, the giant `<style>` block, `updatePanel`, `setStatus`, and every `setStatus(...)` call site. Clean win, ~200 lines gone.
- **Wire it up** — call `createPanel()` from `init()` if you actually want an in-page UI alongside the popup. Worth considering, since the panel has a "Start Capture" button right where users are scrolling, removing one click vs the popup.

Effort: **M** either way (deletion needs to also strip the `setStatus` call sites; wiring up needs cross-surface QA).

---

## Manual QA checklist

The full forkable checklist lives in [`test-checklist.md`](./test-checklist.md) (86 rows across 10 sections — capture pipeline, metadata, popup, gallery viewer/grid/fullscreen/actions, background, autoplay, selection mode, cross-component sync). It's the regression net for any release that touches the capture pipeline or cross-component sync until item #21 lands.

**Use it for**: every release that includes any of items #6–#9, #20, or anything else that touches `injector.js`, `content.js`'s capture/storage/messaging code, `background.js`, or the popup/gallery state-sync code.

**Lifecycle**: temporary scaffolding. Convert to automated tests per item #21 once v4.4.0 proves the inventory is accurate.

---

## Updated release map (as of v4.3.10)

- **v4.3.0** ✅ shipped (items 1–5)
- **v4.3.1–4.3.10** ✅ shipped (items 12, 15, 17a, plus a large polish+features sprint not originally on the roadmap — see the table at the top of this file)
- **v4.4.0 (cleanup only)** — still pending: items 6, 7, 8, 9. Validate against the manual QA checklist. **No new features.**
- **v4.5+**: pick from items 13a, 13b, 16, 17b (CSV), 18, 19, 20 — one per release.

### 21. Convert manual QA checklist to automated tests — **planned post-v4.4.0**

After v4.4.0 ships green and the manual checklist proves the inventory is accurate, port it to real tests. Two layers:

- **Unit / integration**: extend `tests/` for parser + grouping + dedup + metadata extraction. The `__IG_EXPORTER_TEST_HOOKS__` seam already exists; capture 5–10 real Instagram API responses as `tests/fixtures/*.json` and assert the same checklist outcomes (sections A2, A3, A4, A7, B1–B5).
- **Browser end-to-end**: Playwright against a stub Instagram page (or recorded HAR replay) to cover popup ↔ content ↔ gallery flows (sections C, D, E, J). This is the bigger investment — only worth doing once you have ≥1k users or the manual checklist takes >30 min to run.

The manual checklist above is the spec. Each row maps to a test case. Effort: **L** for unit/integration coverage, **L+** for browser e2e. Owner: me. Deadline: before v4.5 ships.
