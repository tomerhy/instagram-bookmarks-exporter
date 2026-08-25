# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Chrome Manifest V3 extension — **Saved Posts Backup & Export** — that lets a
signed-in user back up their own Instagram saved posts locally. It reads the
API/GraphQL responses the page has already received, while the user has capture
explicitly running. No build system — plain JS/HTML/CSS loaded directly by the
browser.

**Read this before changing capture behaviour.** The extension was removed from
the Chrome Web Store (case 79-1827699) over a trademark complaint and a phishing
allegation. v4.4.1 is the remediation: analytics deleted, capture gated behind an
explicit user action and a first-run disclosure, all Instagram branding removed,
permissions cut to the minimum. `COMPLIANCE_EVIDENCE.md` is the audit;
`CWS_STORE_LISTING.md` and `CWS_PRIVACY_DISCLOSURES.md` are the submission
material. Four test suites exist purely to keep those claims true — see
"Compliance invariants" below.

## Common commands

- **Load for development**: open `chrome://extensions/` → enable Developer mode → "Load unpacked" → select repo root.
- **Reload after edits**: hit the refresh icon on the extension card in `chrome://extensions/`. Then reload any open Instagram tab so the content scripts re-inject.
- **Package for distribution**: `./build.sh` → produces `saved-posts-backup-export-<version>.zip` and prints its SHA-256.
- **Bump version**: edit `manifest.json` → `version` field. Recent commits follow `Bump version to X.Y.Z` convention.
- **Regenerate icons**: `python3 tools/make-icons.py`. Requires Pillow. Writes the four manifest-referenced sizes plus a 512px master (`icon-source.png`, a build input that must NOT ship). The old `create-icons.html` generator was deleted in v4.4.1 — it drew Instagram's camera glyph on Instagram's gradient.
- **Run unit tests**: `npm test` (uses `node --test`, no other npm deps). Tests live in `tests/` and exercise pure helpers (URL normalization, hashtag extraction, badge formatting, etc.) by importing source files behind a `globalThis.__IG_EXPORTER_TEST_HOOKS__` seam. They do **not** load the extension into a real browser — manual verification via `chrome://extensions/` is still required for content-script and UI changes.
- **No linter, no bundler.** Debugging is done via `chrome://extensions/` → "service worker" / "Inspect views" links and `console.log` (every component logs with a `[SBE]` / `[Gallery]` / `[Cleanup]` prefix).

## Architecture

### Two content scripts in different worlds (this is the key design)

`manifest.json` registers two content scripts on `instagram.com`:

1. **`capture-hook.js`** — runs in the page's **MAIN world** at `document_start`. The MAIN world is the only place that can see the page's own `fetch`/`XMLHttpRequest`. **It installs nothing at load.** It waits for a `SBE_CAPTURE_CONTROL` message; on `start` it wraps `fetch` + XHR, parses responses for `video_versions` / `image_versions2` / `carousel_media` / GraphQL `edges`, and forwards media via `window.postMessage({ type: 'SBE_MEDIA', ... }, window.location.origin)`; on `stop` it unwraps them — **only if they are still its own wrappers**, so another extension's later wrapper is never clobbered.
2. **`content.js`** — runs in the **isolated world** at `document_idle`. Owns all state (`state.images`, `state.videos`, `state.seenUrls`) and every storage write, drives the auto-scroll loop, and persists to `chrome.storage.local`. It discards every inbound message unless `captureActive` is true, and re-validates sender / origin / envelope / field types / URL allowlist before anything reaches storage. **This is the security boundary** — the MAIN-world copy of the allowlist is a convenience filter the page can tamper with; this one it cannot reach.
3. **`url-allowlist.js`** — loaded into *both* worlds and into `gallery.html`. Single source of truth for which URLs may be stored, rendered, or fetched (`https` + `*.cdninstagram.com` / `*.fbcdn.net` / the two instagram.com hosts, nothing else).

If you change one, **think about the boundary**: the isolated world cannot see page-context globals, and the MAIN world cannot use `chrome.*` APIs. They communicate *only* via `window.postMessage`, targeted at the page origin (never `'*'`).

Because `capture-hook.js` shares a global scope with Instagram's page code, the page *can* forge a control message and switch the reader on. That is deliberately harmless: the reader's only output is a `postMessage` that `content.js` independently validates and drops while capture is off. Never move a security decision into the MAIN world.

History worth knowing: through v4.3.10 `content.js` *also* patched `fetch`/XHR itself, giving two independent interception points (removed in v4.4.0). And through v4.4.0 the MAIN-world script patched unconditionally at `document_start` on every page load — that is the behaviour v4.4.1 exists to fix.

### Capture pipeline

One mechanism, and it only runs while the user has capture on:

- **Response reading (the only path)**: `content.js` scrolls the page so Instagram loads the next slice of the user's own saved feed; `capture-hook.js` reads the responses that arrive. Carousel posts in the grid response usually return only the cover image — the full `carousel_media` array arrives when the user opens the post themselves.
- The scroll loop stops after `maxNoNewContent` consecutive scrolls with no new media, and calls `stopCapture()` on the way out so a self-terminating capture unwraps `fetch`/XHR exactly like an explicit Stop does.
- **Removed in v4.4.1, do not reintroduce**: `scanDom()`, `captureModalImages()` (DOM scraping straight into state), `clickCarouselPost()` / `closeModal()` (click simulation through post modals), the whole selection-mode subsystem, and the commented-out `startClickCapture` block. They were unreachable from any UI but were live code, and each was a write path that bypassed the capture gate. `git show v4.4.0:content.js` if you ever need them.

### Deduplication invariant

URLs from Instagram's CDN have ephemeral signing params, so raw-string comparison sees every refresh as new. **Always normalize before checking/adding to `state.seenUrls`**: `normalizeUrl(url)` returns `pathname + '|' + ig_cache_key + '|' + stp`. `addImage` / `addVideo` / `loadFromStorage` all do this — preserve that contract when adding new code paths.

### Component map

- `background.js` — thin MV3 service worker. Only handles `OPEN_GALLERY`, `GET_DATA`, `CLEAR_DATA` messages. Don't put logic here that needs DOM access.
- `popup.html` + `popup.js` — toolbar popup, and **the only place capture can be started**. Talks to `content.js` via `chrome.tabs.sendMessage` with `GET_STATS`, `START_CAPTURE`, `STOP_CAPTURE`, `CLEAR`. Owns the first-run disclosure UI; `content.js` independently re-checks the stored consent flag, so this is a disclosure surface, not the enforcement point. Polls stats every 2s while open.
- `gallery.html` + `gallery.js` — full-page library (`chrome.runtime.getURL('gallery.html')`). Reads from `chrome.storage.local` directly; does *not* talk to `content.js`. Its `sanitizeImportedItem`/`sanitizeImportedList` are the guard on the Import path — the one place a user-supplied file reaches storage and later `fetch()`.
- `url-allowlist.js` — shared URL allowlist, loaded into both content-script worlds and into `gallery.html`. Exposed as `globalThis.SBE_URL`.
- `legacy-cleanup.js` — one-time removal of `ga_client_id` / `ga_debug` / `ga_session_id` / `igAutoplayEnabled` / `igAutoplayMuted` left behind by features deleted in v4.4.1. Loaded first by both extension pages.
- `tools/make-icons.py` — regenerates the icons. A build input; never shipped.

### Storage shape

Single data key: `chrome.storage.local['igExporterData'] = { images: [...], videos: [...] }`. Each item is `{ type, url, thumbnail, postUrl, postShortcode, carouselIndex, carouselSize, metadata: { caption, owner, takenAt, likeCount, hashtags }, scrapedAt }`. The key name is deliberately unchanged from the pre-rename versions so upgrading users keep their library. `useCount` / `supportDismissed` drive the donation banner threshold.

`sbeConsentAcceptedAt` (epoch ms) records that the first-run disclosure was accepted. `content.js` reads it before every start and refuses without it; Clear all data deletes it, so the disclosure is shown again. `sbeLegacyCleanupAt` is the audit marker written once by `legacy-cleanup.js`.

The full inventory, including everything that is *not* stored, is in `COMPLIANCE_EVIDENCE.md` §9 — keep them in sync.

`igExporterLastSeenAt` (epoch ms) is the timestamp of the last popup/gallery open. `background.js` uses it to compute the toolbar badge as items with `scrapedAt > lastSeenAt` — the badge is a *notification* (new since you last looked), not a total counter. `popup.js` bumps it on open + every 2s poll; `gallery.js` bumps it on load and on new captures arriving. `onInstalled` seeds it to `Date.now()` if missing so upgrade users don't see their entire existing library counted as "unseen."

## Conventions

- **Touch `manifest.json` or an HTML `<script>`/`<link>` ref → update `build.sh` in the same change.** `tests/build.test.js` enforces this; it also asserts that removed files stay out of the zip.
- **Any new code path that pushes into `state.images` / `state.videos` must run the URL through `normalizeUrl()` before checking/adding to `state.seenUrls`.** Skipping this re-introduces duplicates because Instagram's CDN URLs carry ephemeral signing params.
- **Bump `manifest.json` `version` in the same commit as user-visible changes.** Commit-message style: `Bump version to X.Y.Z` (see git log).
- **Tests don't load a browser.** `npm test` runs the real source in a `vm` sandbox. Before declaring a content-script change done: reload the extension at `chrome://extensions/`, reload an Instagram tab, and check the DevTools console for `[SBE]` logs. "It compiles" and "tests pass" are both insufficient.

## Compliance invariants

These are not style preferences. Each one backs a published claim in
`privacy-policy.html` / `CWS_STORE_LISTING.md`, and each is asserted by a test
that will fail if it stops being true. If you need to break one, change the
claim in the same commit.

- **Capture is off by default and never persisted.** Any new code path that reads page data checks `captureActive` first. (`tests/capture-gate.test.js`)
- **No analytics, telemetry, or new external endpoint.** Adding a host means updating `DOCUMENTED_HOSTS` in `tests/compliance.test.js` *and* the outbound-domain table in `COMPLIANCE_EVIDENCE.md`. If you find yourself doing that, stop and reconsider. (`tests/compliance.test.js`)
- **Every URL passes `SBE_URL` before being stored, rendered, fetched, or opened.** Both capture and Import. (`tests/message-validation.test.js`)
- **Every inbound `postMessage` is validated** — sender, origin, envelope shape, field types, size caps — in the isolated world, never only in MAIN. (`tests/message-validation.test.js`)
- **No permission beyond `storage`, `unlimitedStorage`, and the two instagram.com hosts.** (`tests/compliance.test.js`)
- **No credential surface**: no `<form>`, no password input, no cookie/token/auth-header read. (`tests/compliance.test.js`)
- **No Instagram branding**: no brand hex or `rgba()`, no "Instagram" in the extension name, no `instagram-*` download filename, and the non-affiliation disclaimer present in popup + gallery + policy. (`tests/compliance.test.js`)
- **Escape before `innerHTML`.** Captions and usernames are untrusted input. (`tests/escape.test.js`, plus a static check in `tests/compliance.test.js`)

## Gotchas

- **Editing content scripts requires reloading the extension AND the Instagram tab.** Popup-only changes just need an extension reload.
- **`capture-hook.js` runs in MAIN world** — it cannot use `chrome.runtime` / `chrome.storage`, and the page can read and tamper with anything it puts on the global scope. All cross-context data goes through `postMessage`; all security decisions stay in the isolated world.
- **Late `fetch` patching is a known functional risk.** Because v4.4.1 wraps `window.fetch` at Start rather than at `document_start`, calls that resolved `fetch` earlier in page load are no longer seen. XHR is unaffected (prototype lookup happens per call). Verify capture yield in a real browser after touching this. `COMPLIANCE_EVIDENCE.md` §13 has the reasoning and the acceptable fixes — reverting to always-on is not one of them.
- **Don't add remote scripts in MV3** — extension CSP forbids it, and the store listing states there is no remote code.
- **Don't fetch Instagram endpoints directly.** Instagram's `__a=1` returns 404, and more importantly the extension's whole defence is that it only reads responses the page already requested. Constructing an API call breaks that claim.
- **CDN hosts are intentionally absent from `host_permissions`.** Media fetches rely on the CDN's own CORS headers, which is why single-video download opens a tab instead. Adding them would work but costs two host permissions — see `COMPLIANCE_EVIDENCE.md` §3.
