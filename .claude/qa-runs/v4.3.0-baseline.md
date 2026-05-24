# Test Checklist

> **Purpose**: regression checklist for releases that touch the capture pipeline or cross-component sync. Run **twice** per release: once on the previous shipped version (golden baseline) and once on the release candidate, then diff outcomes.
>
> **Lifecycle**: this checklist is interim — it's the spec for the unit/integration/Playwright tests in tech-debt item #21. Until those land, this file is the only regression net we have.

---

## How to use this checklist

1. **Fork it per release**: copy this file to `.claude/qa-runs/v<X.Y.Z>-<rc|baseline>.md`. Don't edit this template directly during a run.
2. **Fill in the run metadata** at the top of your fork.
3. **Work top to bottom**. Each row is a `- [ ]` markdown checkbox — tick it Pass, replace with `- [x] FAIL — <note>` on failure, or `- [x] N/A — <reason>` if not applicable.
4. **Don't skip sections** unless explicitly marked optional.
5. **At the end**, fill in the Result Summary block. If anything is Fail in **section A or J**, the release is blocked.
6. **Always run baseline first**. Without a v<X.Y.Z>-baseline run on the previously-shipped version using the same test account and same scroll pattern, you can't tell a regression from a pre-existing bug.

---

## Run metadata

Fill these in at the start of every run.

- **Version under test**:
- **Baseline version (compare against)**:
- **Run type**: ☐ baseline ☐ release-candidate
- **Tester**:
- **Date / time started**:
- **Chrome version**:
- **Test Instagram account**:
- **Storage snapshot before run**: ☐ saved at `qa-runs/<run-id>-storage-before.json`
- **Storage snapshot after run**: ☐ saved at `qa-runs/<run-id>-storage-after.json`

---

## Pre-test setup

Required before starting any section.

### Test Instagram account composition

The test account must currently have **at least all of the following** in saved posts:

- [ ] ≥5 single-image posts
- [ ] ≥5 single-video posts (mix of feed videos + reels)
- [ ] ≥5 carousel posts with varying slide counts (e.g. 2, 4, 7, 10 slides)
- [ ] ≥1 carousel that mixes images and videos
- [ ] ≥3 reels in the saved tab
- [ ] ≥1 post with a long caption (>280 chars)
- [ ] ≥1 post with at least 3 hashtags in the caption
- [ ] Total ≥20 saved posts spanning the formats above

### Browser

- [ ] Chrome stable, fresh profile (no other extensions interfering)
- [ ] DevTools open on the Instagram tab
- [ ] Console filter set to `[IG Exporter]` (capture-pipeline logs)
- [ ] Second filter tab for `[Gallery]` and `[IG Autoplay]` (other components)

### Storage snapshots

Before the run, on the gallery tab DevTools console:

```js
chrome.storage.local.get(null, (r) => copy(JSON.stringify(r, null, 2)))
```

Paste into `qa-runs/<run-id>-storage-before.json`. Repeat after the run for `-storage-after.json`. The diff between baseline and rc storage states is the strongest single signal of a regression.

---

## A. Capture pipeline

> Highest risk for any cleanup that touches `injector.js`, `content.js` interception code, or the message bridge between MAIN and isolated worlds.

- [ ] **A1**. Capture single image from saved-posts grid via scroll-only mode → image appears in `state.images` within 2 s of scrolling past
- [ ] **A2**. Capture single video from saved-posts grid → video appears in `state.videos` with non-empty `url` and `thumbnail`
- [ ] **A3**. Capture carousel cover from saved-posts grid → cover image appears with `postShortcode` set, `carouselSize ≥ 2`, `carouselIndex = 0`
- [ ] **A4**. Capture full carousel slides — open a saved carousel, walk every slide → all N slides captured, each with same `postShortcode` and distinct `carouselIndex` 0..N-1
- [ ] **A5**. Capture from individual post page — navigate directly to `/p/<shortcode>/` → all slides captured on page load, no scroll needed
- [ ] **A6**. Capture from reels feed at `/reels/`, scroll → reel videos captured with `type: 'video'` and a CDN URL
- [ ] **A7**. URL deduplication — scroll the same post into view twice → `state.images.length` does not increase on second pass; `[IG Exporter] X dupes` log shows dedup happened
- [ ] **A8**. Auto-scroll loop — click "Capture All" in the popup on the saved grid → scroll continues for ≥10 cycles or until 5 consecutive no-new-content scrolls; stops cleanly
- [ ] **A9**. Stop button mid-capture — click "Stop" while auto-scroll is running → loop exits within one cycle, status updates, button label flips back to "🎠 Capture All"
- [ ] **A10**. Capture survives page navigation — capture, navigate to another Instagram page, return → captured data persists, gallery shows all items

---

## B. Metadata capture

> v4.3 features. Verify nothing in the cleanup silently dropped these.

- [ ] **B1**. `metadata.caption` populated for posts with captions
- [ ] **B2**. `metadata.owner` populated as the IG username on every captured item
- [ ] **B3**. `metadata.takenAt` populated as ISO date string matching the post's actual date
- [ ] **B4**. `metadata.likeCount` populated as a numeric value within ±10% of IG's displayed count (IG rounds for display)
- [ ] **B5**. `metadata.hashtags` extracted — array contains every `#tag` from caption text
- [ ] **B6**. Post metadata renders in gallery viewer — click an item with metadata → owner, date, caption visible under the preview
- [ ] **B7**. Owner overlay on grid card — cards with `metadata.owner` show `@username` overlay on hover
- [ ] **B8**. Carousel size badge on grid card — carousel posts show `📷 N` badge top-left

---

## C. Popup UI

- [ ] **C1**. Stats display — image and video counts match storage
- [ ] **C2**. Stats poll every 2 s — counts update without re-opening popup (capture in another tab while popup is open)
- [ ] **C3**. "Capture All" starts auto-scroll on the active Instagram tab; button label changes to "⏹️ Stop"
- [ ] **C4**. "Stop" stops the auto-scroll; button label reverts
- [ ] **C5**. "Gallery" opens new tab at `chrome-extension://.../gallery.html`
- [ ] **C6**. "Clear" wipes data — both counts go to 0, storage `igExporterData` cleared, badge clears
- [ ] **C7**. Auto-play toggle loads correct state — toggle reflects stored `igAutoplayEnabled` (default ON for fresh installs)
- [ ] **C8**. Auto-play toggle persists — flip toggle, close popup, reopen → state remembered
- [ ] **C9**. Auto-play toggle live-pushes — flip toggle while watching IG video → next scrolled-into-view video respects new state without page reload
- [ ] **C10**. "Not on Instagram" view — open popup on a non-IG tab → shows "📍 Open Instagram" message instead of stats
- [ ] **C11**. Support banner appears at threshold — `useCount ≥ 15` → banner visible. Fast-path: `chrome.storage.local.set({ useCount: 15 })`
- [ ] **C12**. Support banner dismiss — "Maybe later" hides it, sets `supportDismissed: true`, never re-appears
- [ ] **C13**. "Buy me a coffee" link opens `https://buymeacoffee.com/thyproduction` in a new tab
- [ ] **C14**. Version label — shows `v` + `manifest.json` version

---

## D. Gallery — viewer + grid

- [ ] **D1**. Tabs: Images / Videos — click switches active state, count badges match storage
- [ ] **D2**. 5-column grid layout at typical viewport width
- [ ] **D3**. Pagination — >50 items → pagination shown, page nav works, `←` / `→` disable at edges
- [ ] **D4**. Auto-select first item on load — first card highlighted, viewer shows preview without click
- [ ] **D5**. Click card selects + previews — border highlights, viewer updates to that item
- [ ] **D6**. Image preview renders in `#image-viewer` and fits inside viewer panel
- [ ] **D7**. Video preview (playable URL) — video plays in `#player`
- [ ] **D8**. Video preview (non-playable URL) — falls back to thumbnail + "Open on Instagram" link
- [ ] **D9**. Carousel grouping — carousel posts collapse to single grid card with `📷 N` badge; click opens cover in viewer
- [ ] **D10**. Owner overlay on cards — cards with metadata show `@username` overlay
- [ ] **D11**. Viewer metadata block — selected item shows owner / date / album-size / caption (truncated at 280 chars with `…`)
- [ ] **D12**. Viewer metadata HTML escape — caption containing `<script>` etc. renders as literal text, not parsed
- [ ] **D13**. Empty state — no captured items → empty message visible
- [ ] **D14**. Reload on tab focus — gallery in background, capture in IG tab, switch back → counts and grid update
- [ ] **D15**. Reload on visibilitychange — same as D14 but switch via cmd+tab
- [ ] **D16**. React to storage clear from popup — popup → Clear → gallery re-renders empty without page reload

---

## E. Gallery — fullscreen + slideshow

- [ ] **E1**. Fullscreen button on image viewer — hover preview → "⛶" appears top-right; click opens fullscreen overlay
- [ ] **E2**. Fullscreen image fills overlay, ≤90vw × 80vh
- [ ] **E3**. Fullscreen video plays with controls + autoplay
- [ ] **E4**. Prev / Next nav cycles through flat list of all slides across all posts (carousel slides counted individually)
- [ ] **E5**. Counter — "X / N" updates with current index
- [ ] **E6**. Keyboard: Arrow Right / Space → Next
- [ ] **E7**. Keyboard: Arrow Left → Prev
- [ ] **E8**. Keyboard: Escape → Close
- [ ] **E9**. Click outside image (on dark overlay) → Close
- [ ] **E10**. Slideshow 2s / 3s / 5s — selected speed advances slides at that interval; active button highlighted
- [ ] **E11**. Slideshow Stop — stops auto-advance, hides Stop button, clears active state
- [ ] **E12**. Slideshow buttons hidden for videos — when current item is video, 2s/3s/5s buttons are hidden
- [ ] **E13**. Auto-advance on video end — fullscreen video finishes → next item shown
- [ ] **E14**. Non-fullscreen slideshow — click 2s/3s/5s under the viewer → opens fullscreen + starts slideshow at that speed

---

## F. Gallery — actions

- [ ] **F1**. Download Current — image — triggers blob fetch, downloads `instagram_<ts>.jpg`
- [ ] **F2**. Download Current — video — opens video URL in a new tab (CORS-blocked from blob fetch)
- [ ] **F3**. Download Current — no selection — status shows "Select an item first"
- [ ] **F4**. Export Images / Export Videos — downloads `instagram-images.txt` / `instagram-videos.txt` with one URL per line
- [ ] **F5**. Copy Images / Copy Videos — clipboard contains URLs for current tab, status shows count
- [ ] **F6**. Import — file picker → load `.txt` of URLs → grid populated for current tab, storage updated
- [ ] **F7**. Button labels follow active tab — Tab=Images → "Export Images" / "Copy Images"; Tab=Videos → "Export Videos" / "Copy Videos"
- [ ] **F8**. Clear All — both arrays emptied, storage cleared, grid empty, popup count syncs to 0
- [ ] **F9**. Donate — opens Patreon page in a new tab

---

## G. Background / badge

- [ ] **G1**. Badge updates on capture — capture adds N items → toolbar badge shows new total within ~1 s
- [ ] **G2**. Badge format <1000 — e.g. "847"
- [ ] **G3**. Badge format <10k — e.g. "1.2k"
- [ ] **G4**. Badge format <1M — e.g. "12k"
- [ ] **G5**. Badge format ≥1M — "999+"
- [ ] **G6**. Badge clears on Clear — total = 0 → badge text empty
- [ ] **G7**. Badge survives extension restart — disable + re-enable extension at `chrome://extensions/` → badge restored from storage

---

## H. In-page autoplay (`autoplay.js`)

- [ ] **H1**. Most-visible video auto-plays — scroll until video reaches >50% viewport → plays
- [ ] **H2**. Muted by default — first played video is muted (browser autoplay policy)
- [ ] **H3**. Double-click toggles mute — preference persists across page reloads
- [ ] **H4**. Manual pause respected — user pauses → next scroll does NOT auto-play that same video again
- [ ] **H5**. Preload next at 80% — next observed video's `preload` flips to `metadata` when current passes 80%
- [ ] **H6**. Disable via popup toggle — toggle off → no new auto-plays trigger; an already-playing video continues

---

## I. In-page selection mode (optional)

> **Optional**: gated behind the `TOGGLE_SELECTION_MODE` message, which **no current UI sends**. Skip unless you trigger it manually via DevTools `chrome.tabs.sendMessage`. Tracked separately as a tech-debt item (surface this UI or delete the code).

- [ ] **I1**. Enter selection mode — checkboxes appear on visible posts, bottom selection bar appears
- [ ] **I2**. Click post → selects — checkbox marked, count in bar increments
- [ ] **I3**. Select All — every visible post marked
- [ ] **I4**. Deselect All — all marks cleared
- [ ] **I5**. Capture Selected — only marked posts captured into state
- [ ] **I6**. Infinite scroll → new posts get checkboxes — MutationObserver adds boxes to lazy-loaded posts
- [ ] **I7**. Exit selection mode — all checkboxes removed, bar removed

---

## J. Cross-component sync

> Most likely to break silently. Co-equal with section A as the cleanup's risk surface.

- [ ] **J1**. Capture in IG tab → popup count updates — popup open during capture → count rises within 2 s (poll)
- [ ] **J2**. Capture in IG tab → badge updates — badge total rises within ~1 s of `saveToStorage`
- [ ] **J3**. Capture in IG tab → gallery (open) updates — open gallery in another tab during capture → grid populates on `storage.onChanged`
- [ ] **J4**. Clear from popup → IG tab content state resets — Popup Clear → return to IG tab, run `state` in console (via `__IG_EXPORTER_TEST_HOOKS__`) → all arrays empty, `seenUrls` cleared
- [ ] **J5**. Clear from popup → gallery (open) re-renders empty — without manual reload
- [ ] **J6**. Clear from popup → badge clears — within ~1 s
- [ ] **J7**. Clear from gallery → popup + badge sync — same as J4–J6 but trigger from gallery's "Clear All"
- [ ] **J8**. Re-capture after clear works — after clear, scroll IG → new captures appear cleanly (no leftover dedup entries blocking re-capture)

---

## Result summary

Fill in at the end of the run.

- **Total rows tested**: ___ / 86 (excluding optional section I if skipped)
- **Pass**: ___
- **Fail**: ___
- **N/A**: ___
- **Time taken**: ___ minutes
- **Verdict** (circle one):
  - ☐ All green — ship to staged rollout
  - ☐ Failed in A or J — **release blocked**, file bug + investigate before re-running
  - ☐ Failed in B–G — verify against baseline run; if also fails on baseline, file as pre-existing bug, do not block release

### Diff vs baseline

If this is a release-candidate run, list any rows where the rc result differs from the baseline run:

| Row | Baseline | RC | Notes |
|---|---|---|---|
|     |          |    |       |

### Storage diff

Any unexpected differences between `<run-id>-storage-before.json` and `<run-id>-storage-after.json`, or between baseline and rc storage states:

-

### Open issues raised by this run

-
