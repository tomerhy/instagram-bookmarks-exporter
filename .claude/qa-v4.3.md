# v4.3 QA Checklist

There are no automated tests. Walk this list before publishing to the Chrome Web Store. Every item ends with explicit pass criteria — don't skip them.

> Estimated time: 25–30 min if data is already captured, 45–60 min from a clean install.

---

## 0. Pre-flight

- [ ] `chrome://extensions/` → reload the extension. No red errors on the card.
- [ ] Click the extension's "service worker" link → background console shows no errors.
- [ ] Open `instagram.com` in a fresh tab. DevTools console shows three log prefixes within 2s of load:
  - `[IG Exporter] API interceptor active in page context` (from injector.js, MAIN world)
  - `[IG Exporter] Content script loaded` (from content.js, isolated world)
  - No `[IG Autoplay]`-prefixed errors. Autoplay is silent on success.

**Fail = stop here, don't ship.** A console error in any of those three is a regression.

---

## 1. Autoplay (item #1)

### 1a. Saved-posts grid (or any page with `<video>` elements)

Autoplay is a **silent feature** — no extension overlay is painted on top of Instagram's video. Visual feedback comes entirely from Instagram's native player (mute icon, scrubber). The pass criterion is functional: do videos auto-play as you scroll?

- [ ] Navigate to `instagram.com/reels/` (recommended — guaranteed `<video>` elements) or your saved-posts grid.
- [ ] Open DevTools console. Within ~1s of page load, you should see: `[IG Autoplay] Active. enabled=true muted=true videosFound=N...`
  - If `videosFound` is 0, the page has no real `<video>` elements on it (some saved-posts grids only render `<img>` thumbnails). Switch to `/reels/`.
- [ ] Scroll slowly. As a video crosses ~50% viewport visibility, it starts playing automatically (muted).
- [ ] Continue scrolling. Only **one** video plays at a time (the most-visible one). Others pause.
- [ ] Click a playing video to manually pause. Scroll past it and back — it stays paused (manual override is sticky).
- [ ] Toggle the autoplay setting in the popup. Off → playing video pauses immediately. On → most-visible video resumes within ~500ms (no refresh needed).

To check live state from console: `__igAutoplay.getState()` returns `{ enabled, muted, videoCount }`.

### 1b. Reels feed
- [ ] Open `instagram.com/reels/`. As reels cycle, autoplay should not interfere (Instagram's own playback wins, no double-play).
- [ ] Scroll. No spammy console errors from autoplay.js.

### 1c. Single post page
- [ ] Open any post URL with a video. The video plays muted on visibility. Mute button works.

### 1d. Tab switch
- [ ] Switch to another tab while a video is playing. Switch back. Video resumed/paused correctly (the page does what Instagram itself would do — no zombie audio).

**Pass = all four sub-tests pass.** Fail any → likely conflict with capture loop or DOM structure change on Instagram side.

---

## 2. Autoplay popup toggle

- [ ] Click the extension icon. The popup shows a new row "🎬 Auto-play videos" with a toggle that defaults to **on**.
- [ ] Flip toggle **off**. On the open Instagram tab, currently-playing video pauses immediately. Scrolling past videos no longer auto-plays them.
- [ ] Flip toggle **on**. Scroll a video into view — it plays again.
- [ ] Open a **second** Instagram tab. The toggle's state is respected there too (storage-driven, not just per-tab message).
- [ ] Close the popup, reload the extension, reopen popup. Toggle reflects the last-set state.

**Pass = toggle persists across reloads and propagates to all open IG tabs.**

---

## 3. Album mode — carousel grouping (item #2)

> Best tested with at least one carousel post in your saved posts. If you don't have one, save a friend's carousel before testing.

- [ ] Click "🎠 Capture All" (or scroll the saved grid). Wait for capture to finish.
- [ ] Open the gallery (popup → 🖼️ Gallery, or floating panel → Gallery).
- [ ] Find a carousel post. It should appear as **one** card with a "📷 N" badge in the top-left (where N is the slide count).
- [ ] Verify: a 5-slide carousel shows up as **one** card, not five. Pre-v4.3 it would have been five.
- [ ] Click the card. The viewer shows the cover (slide 1). The metadata block below the viewer shows "📷 5 slides".
- [ ] Click the fullscreen button (⛶). Use ← / → to navigate. The counter shows "X / N" where N is the **total slides across all posts in the gallery** (every individual carousel slide + every single post counts as one entry).
- [ ] After clicking past the last slide of a carousel, Next advances into the **next post** (not back to slide 1 of the same carousel).

**Pass = carousels are grouped, fullscreen scopes prev/next to the post.**

### 3a. Slideshow within an album
- [ ] On a carousel cover, click "2s" slideshow in fullscreen. Slides cycle every 2s, then loop back to slide 1.

### 3b. Single-image post (regression)
- [ ] On a single-image post (no carousel badge), click → fullscreen → ← / →. Navigation walks the **gallery** (across posts), not within the post (since there's only one slide).

---

## 4. Metadata display (item #3)

> Requires a fresh capture pass on v4.3 — old items captured pre-v4.3 won't have metadata.

- [ ] Run a fresh capture: clear the gallery, then capture again.
- [ ] In the gallery grid, hover over cards. Cards with metadata show an `@username` overlay at the bottom on hover (and stay visible without hover for cards with the overlay built in).
- [ ] Click any card. The "viewer-meta" block under the preview displays:
  - `@username` (pink)
  - Post date (locale format, e.g. `4/29/2026`)
  - Caption (truncated to 280 chars, ellipsis if longer)
  - "📷 N slides" if it's a carousel
- [ ] Cards without an `@username` (legacy / non-carousel pre-v4.3 items) hide the overlay. The viewer-meta block stays hidden for them too.

**Pass = metadata appears on freshly-captured items, gracefully absent on legacy items.**

---

## 5. Legacy-data compatibility

> Only relevant if you can roll back to v4.2.3 first or have v4.2.x data in storage.

- [ ] (If possible) Sideload v4.2.3, capture some posts, then upgrade to v4.3. The gallery still loads existing items. They render without metadata badges, without `@username` overlays, without grouping. **No errors.**
- [ ] On v4.3 data, confirm no console errors when older items mix with new metadata-bearing items in the same gallery.

**Pass = no breakage on upgrade.** The single biggest risk in v4.3.

---

## 6. `build.sh` sanity (item #4)

- [ ] From the repo root: `./build.sh`
- [ ] `unzip -l instagram-saved-media-exporter.zip | grep -E "injector|content-styles|analytics|autoplay|manifest"` — all five names appear in the listing.
- [ ] Move the existing extension out of `chrome://extensions/`. Drop the new zip onto the page (or unpack and load unpacked from `dist/`). Repeat tests 0, 1a, 3, 4 against the **packaged** build.

**Pass = the zip-built extension behaves identically to the unpacked dev build.**

---

## 7. Regression — existing features still work

- [ ] **Capture button** in popup: starts/stops scroll capture. Stats update live.
- [ ] **Clear** in popup and gallery: empties storage, gallery shows empty state.
- [ ] **Export Images** / **Export Videos**: downloads a `.txt` of URLs.
- [ ] **Copy Images** / **Copy Videos**: clipboard contains the URLs.
- [ ] **Import**: loads URLs from a `.txt` back into the gallery.
- [ ] **Tabs (Images / Videos)**: counts and grid switch correctly. The carousel-badge appears on the videos tab too if a carousel post had video children.
- [ ] **Donate / Buy me a coffee**: opens the right URL.
- [ ] **Slideshow** controls in fullscreen: 2s/3s/5s start, Stop button stops.

**Pass = no v4.2.3 feature regressed.** This is the long-tail risk of the storage-shape change.

---

## 8. Chrome Web Store update copy

When promoting v4.3, the changelog should be:

> **v4.3 — Album mode, video autoplay, post details**
>
> - 📷 **Album mode**: Carousels now appear as a single post in the gallery. Click in for a slide-by-slide viewer with prev/next/slideshow.
> - 🎬 **Video auto-play**: Videos in saved posts auto-play as you scroll, like the real Instagram. Toggle in the popup.
> - 👤 **Post details**: See the username, post date, and caption in the gallery viewer.
> - Internal cleanup and bugfixes.

---

## If something fails

- Console error on inject → check `manifest.json` content_scripts wiring (autoplay needed isolated world for `chrome.*` API access).
- Carousel still appears as N items → check the captured item objects in `chrome.storage.local`: they should have `postShortcode` and `carouselIndex`. If null, the injector didn't extract them — likely a new IG API shape that `extractCaption`/`buildContext` doesn't handle yet.
- Toggle doesn't propagate live → confirm `chrome.storage.onChanged` listener in `autoplay.js` fired (add a temp `console.log` if needed).
- Build zip is missing files → `build.sh` regression; recheck the `cp` list.
