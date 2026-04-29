# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Chrome Manifest V3 extension that captures media (images, videos, carousels) from Instagram saved posts by intercepting Instagram's own API responses, with a DOM-scanning + auto-scroll driver as fallback. No build system — plain JS/HTML/CSS loaded directly by the browser.

## Common commands

- **Load for development**: open `chrome://extensions/` → enable Developer mode → "Load unpacked" → select repo root.
- **Reload after edits**: hit the refresh icon on the extension card in `chrome://extensions/`. Then reload any open Instagram tab so the content scripts re-inject.
- **Package for distribution**: `./build.sh` → produces `instagram-saved-media-exporter.zip`. ⚠️ See "build.sh is incomplete" below before trusting the zip.
- **Bump version**: edit `manifest.json` → `version` field. Recent commits follow `Bump version to X.Y.Z` convention.
- **Regenerate icons** (rarely needed): open `create-icons.html` in a browser, download PNGs to `assets/icons/`. Several alternate generators exist (`create_icons.py`, `create_clean_icons.py`, `convert_icons.py`, `generate-icons.sh`) — `create-icons.html` is the one the README points users at.
- **Run unit tests**: `npm test` (uses `node --test`, no other npm deps). Tests live in `tests/` and exercise pure helpers (URL normalization, hashtag extraction, badge formatting, etc.) by importing source files behind a `globalThis.__IG_EXPORTER_TEST_HOOKS__` seam. They do **not** load the extension into a real browser — manual verification via `chrome://extensions/` is still required for content-script and UI changes.
- **No linter, no bundler.** Debugging is done via `chrome://extensions/` → "service worker" / "Inspect views" links and `console.log` (every component logs with a `[IG Exporter]` / `[Gallery]` / `[Analytics]` prefix).

## Architecture

### Two content scripts in different worlds (this is the key design)

`manifest.json` registers two content scripts on `instagram.com`:

1. **`injector.js`** — runs in the page's **MAIN world** at `document_start`. This is the only place we can monkey-patch `window.fetch` and `XMLHttpRequest` so that Instagram's *own* API calls are intercepted before the page code captures references to them. It parses responses for `video_versions` / `image_versions2` / `carousel_media` / GraphQL `edges`, then forwards extracted media to the isolated world via `window.postMessage({ type: 'IG_EXPORTER_MEDIA', media: [...] })`.
2. **`content.js`** — runs in the **isolated world** at `document_idle`. Listens for those `postMessage` events, owns all state (`state.images`, `state.videos`, `state.seenUrls`, `state.selectedShortcodes`), renders the floating in-page panel, drives auto-scroll, and persists to `chrome.storage.local`.

If you change one, **think about the boundary**: the isolated world cannot see page-context globals, and the MAIN world cannot use `chrome.*` APIs. They communicate *only* via `window.postMessage`. `content.js` *also* installs its own `fetch`/XHR hooks as a redundant safety net (see `parseApiResponse`) — both layers run.

### Capture pipeline

Two complementary mechanisms feed the same `state.images` / `state.videos` arrays:

- **API interception (primary)**: as the user scrolls, Instagram fires GraphQL/REST calls for the saved-posts feed; the injector parses them. Carousel posts in the grid response usually return only the cover image — the full `carousel_media` array is delivered when the user (or our auto-clicker) opens the post, which the injector then catches.
- **DOM scanning + auto-scroll (driver / fallback)**: `startAutoClickCapture()` in `content.js` is a misnamed "scroll-only mode" loop that scrolls the page to *trigger* more API calls (which the injector intercepts). It stops after `maxNoNewContent` consecutive scrolls with no new media. There's also a `scanDom()` fallback that pulls `cdninstagram` / `fbcdn` `<img>` and `<video>` elements directly.
- A click-based capture path that opens each post modal and walks carousel slides exists but is **commented out as a giant block comment** (`/* CLICK-BASED CAPTURE (DISABLED ...) */`). Keep it intact unless you intend to revive it.

### Deduplication invariant

URLs from Instagram's CDN have ephemeral signing params, so raw-string comparison sees every refresh as new. **Always normalize before checking/adding to `state.seenUrls`**: `normalizeUrl(url)` returns `pathname + '|' + ig_cache_key + '|' + stp`. `addImage` / `addVideo` / `loadFromStorage` all do this — preserve that contract when adding new code paths.

### Component map

- `background.js` — thin MV3 service worker. Only handles `OPEN_GALLERY`, `GET_DATA`, `CLEAR_DATA` messages. Don't put logic here that needs DOM access.
- `popup.html` + `popup.js` — toolbar popup. Talks to `content.js` via `chrome.tabs.sendMessage` with message types `GET_STATS`, `START_CAROUSELS`, `STOP_CAROUSELS`, `CLEAR`, `TOGGLE_SELECTION_MODE`. Polls stats every 2s while open.
- `gallery.html` + `gallery.js` — full-page gallery (`chrome.runtime.getURL('gallery.html')`). Reads from `chrome.storage.local` directly; does *not* talk to `content.js`.
- `content-styles.css` — styles for the floating in-page panel injected by `content.js`. **Loaded via `manifest.json`'s `content_scripts.css`**, not via `<link>`.
- `analytics.js` — GA4 Measurement Protocol (uses `fetch` to `google-analytics.com/mp/collect`); chosen because MV3 forbids remote-loaded `<script>`s. The `GA_API_SECRET` is checked in (it's a measurement-protocol write key, not a credential — but be aware). Loaded by both `popup.html` and `gallery.html`. Event catalogue is in `ANALYTICS.md`.
- `injector.js` vs `autoplay.js` — only `injector.js` is wired into the manifest. `autoplay.js` is **not referenced anywhere** and is currently dead code; don't assume edits to it take effect.

### Storage shape

Single key: `chrome.storage.local['igExporterData'] = { images: [...], videos: [...], carousels: [...] }`. Each item is `{ type, url, thumbnail, postUrl, scrapedAt }`. Legacy keys `imageUrls` / `videoUrls` are still cleared on `CLEAR` for backward compat — don't write to them. `useCount` / `supportDismissed` keys drive the "buy me a coffee" banner threshold.

## Conventions

- **Touch `manifest.json` or an HTML `<script>`/`<link>` ref → update `build.sh` in the same change.** The current `build.sh` is already out of sync; don't make it worse.
- **Any new code path that pushes into `state.images` / `state.videos` must run the URL through `normalizeUrl()` before checking/adding to `state.seenUrls`.** Skipping this re-introduces duplicates because Instagram's CDN URLs carry ephemeral signing params.
- **Bump `manifest.json` `version` in the same commit as user-visible changes.** Commit-message style: `Bump version to X.Y.Z` (see git log).
- **No tests = manual verification is the only validation.** Before declaring a content-script change done: reload the extension at `chrome://extensions/`, reload an Instagram tab, and check the DevTools console for `[IG Exporter]` logs. "It compiles" is not evidence.
- **Don't revive the commented-out click-based capture block in `content.js`** (`/* CLICK-BASED CAPTURE (DISABLED ...) */`) without an explicit ask. It's preserved intentionally as a reference implementation, not as cleanup debt.
- **The `GA_API_SECRET` in `analytics.js` is a GA4 Measurement Protocol write key, not a credential — leave it checked in.** Don't "fix" it by moving to env vars; Chrome extensions don't have env vars and the key has no read access.

## Gotchas

- **`build.sh` is incomplete.** It copies `manifest.json`, `background.js`, `content.js`, `popup.{html,js}`, `gallery.{html,js}`, and `assets/`, but **omits `injector.js`, `content-styles.css`, and `analytics.js`** — all three are referenced by the manifest or HTML and the resulting zip will be broken without them. Update `build.sh` before relying on its output for a Chrome Web Store submission.
- **Editing content scripts requires reloading the extension AND the Instagram tab.** The popup-only changes just need an extension reload.
- **Don't add network calls to remote scripts in MV3** — extension CSP forbids it; that's why analytics is done via Measurement Protocol and not gtag.js.
- **Instagram's `__a=1` endpoint returns 404** (noted in `content.js`). Carousel children only arrive when a post modal opens. If you're tempted to fetch them directly, expect to fail.
- **The injector runs in MAIN world** — it cannot use `chrome.runtime` / `chrome.storage`. All cross-context data must go through `postMessage`.
