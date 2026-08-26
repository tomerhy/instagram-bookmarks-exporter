# Saved Posts Library & Export

A Chrome extension that keeps a **local library** of the posts you have saved
on instagram.com — the links and the post details — and downloads the media you
choose to keep.

> **Capture is not the same as download.** Capture records URLs and metadata.
> Instagram's media URLs expire, so the library alone is not a permanent offline
> copy; only media you explicitly download becomes a durable file.

> **Independent third-party extension. Not affiliated with, authorized by,
> endorsed by, or sponsored by Instagram or Meta.** "Instagram" is a trademark
> of Meta Platforms, Inc., used here only to describe factually where the
> extension works.

## What it does

- **Explicit capture.** Nothing is read or stored until you press *Start
  capture*. Pressing *Stop*, or reloading the page, turns it off again. Capture
  state is never persisted, so opening Instagram never starts a capture.
- **Images, videos, and albums.** Multi-image carousels are kept together and
  in order.
- **Post details preserved.** Author, caption, date, like count, hashtags.
- **Library page.** Browse, search (caption / `@author` / `#tag`), and sort
  what you captured. Browsing and searching work offline; showing a preview or
  downloading a file fetches the media from Instagram's CDN at that moment.
- **Downloads.** Individual files, per-album ZIP, or a whole-library ZIP
  grouped by author.
- **Portable.** JSON export/import round-trips all metadata; CSV export for
  spreadsheets.

## Privacy

- Everything captured stays on your device in `chrome.storage.local`.
- **No analytics, no tracking, no advertising, no developer server.**
- It never asks for, reads, or stores your password, cookies, session tokens,
  or two-factor codes. There is no login form anywhere in it.
- Three things requested, and nothing else: the `storage` permission, the
  `unlimitedStorage` permission (quota only, no data access), and host access to
  `instagram.com`. The CDN hosts are **not** requested as permissions.
- The captured library is never sent to the developer. Two tiers of CDN traffic
  do occur, and the difference matters: **automatically** when the library
  renders a thumbnail or preview (displaying a stored image URL means fetching
  it), and **explicitly** when you press Download or a ZIP button. Both go to
  Instagram/Meta, not to us.
- It never *reads* your clipboard. It *writes* to it only when you press Copy
  URLs.
- It does not request the `downloads` permission and cannot read your download
  history; it does create the downloads you ask for.
- Local interaction state is stored: a consent timestamp (which is what enforces
  the consent gate) and a last-seen timestamp (which drives the "new items"
  badge). Nothing else, and nothing transmitted. 4.4.3 removed the popup-use
  counter that used to trigger a donation prompt.
- *Clear all data* deletes the whole library immediately.

Full details in [`privacy-policy.html`](privacy-policy.html). Versions up to and
including 4.4.0 contained Google Analytics; that is documented, not glossed
over, in the policy's "Change history" section and in
[`COMPLIANCE_EVIDENCE.md`](docs/COMPLIANCE_EVIDENCE.md).

## Install for development

1. Open `chrome://extensions/`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. After editing a content script, hit refresh on the extension card **and**
   reload the Instagram tab so the scripts re-inject.

Icons are generated, not hand-edited. The icon is the developer's own portrait
on a neutral slate/teal plate — see `tools/make-icons.py` for the provenance and
the reason the previous pink/magenta gradient is gone:

```bash
python3 tools/make-icons.py
```

## Usage

1. Sign in to instagram.com as normal and open your saved posts.
2. Click the extension icon → **Start capture**. The first time, a disclosure
   explains exactly what will be read and stored; nothing happens until you
   accept it.
3. The page scrolls so more of your saved posts load, and counts rise in the
   popup.
4. **Stop capture** when you have enough.
5. **Library** opens the gallery to browse and download.

## Architecture

Three execution contexts, which is the thing to understand before changing
anything:

| File | Context | Role |
|---|---|---|
| `url-allowlist.js` | MAIN + isolated + gallery page | The single source of truth for which URLs may be stored, rendered, or fetched. Pure functions. |
| `capture-hook.js` | page **MAIN world**, `document_start` | Installs nothing at load. On an explicit start signal it wraps `window.fetch` and `XMLHttpRequest`, reads response bodies the page already received, and forwards extracted media. On stop it unwraps them — but only if they are still its own wrappers. |
| `content.js` | **isolated world**, `document_idle` | Owns all state and every storage write. Re-validates every inbound message: sender, origin, envelope shape, item types, URL allowlist, field-by-field clamping. This is the security boundary. |
| `background.js` | service worker | Gallery navigation and the toolbar badge. No DOM access. |
| `popup.html/js` | extension page | The only place capture can be started. Owns the first-run disclosure. |
| `gallery.html/js` | extension page | Reads `chrome.storage.local` directly; never talks to the content script. |
| `library-sanitize.js` | isolated world + gallery page | **The** authoritative sanitiser. Rebuilds every stored record field by field, wherever the library enters the process — storage load, storage change, import. Added in 4.4.2 after a review found legacy records were loaded unvalidated. |
| `legacy-cleanup.js` | extension pages | One-time removal of state left by the removed analytics and autoplay features. |

The two worlds communicate **only** via `window.postMessage`, targeted at the
page origin. The isolated world cannot see page globals; the MAIN world cannot
use `chrome.*`.

### Invariants worth not breaking

- **Capture is off by default.** Any new code path that reads page data must
  check `captureActive` first.
- **Every URL goes through `SBE_URL`.** Storing, rendering, or fetching a URL
  that has not passed `isAllowedMediaUrl` / `isAllowedPostUrl` is a security
  regression, and `tests/compliance.test.js` will say so.
- **Normalize before deduplicating.** Instagram CDN URLs carry ephemeral signing
  params, so `normalizeUrl()` (pathname + `ig_cache_key` + `stp`) is what goes
  into `state.seenUrls` — never the raw string.
- **Sanitise the library at every entry point.** `adoptLibrary()` in gallery.js
  is the only thing allowed to assign `allMedia.images` / `allMedia.videos`, and
  it routes through `SBE_LIB.sanitizeLibrary`. `content.js#loadFromStorage` does
  the same, so a legacy record can never be re-persisted.
- **Validate at every sink, again.** `safeMediaUrl` / `safePostUrl` /
  `safeExternalNavigationUrl` wrap every `.src`, `.href`, `window.open`,
  `fetch`, clipboard and export use. `tests/url-sinks.test.js` enumerates the
  sinks and fails on any new unguarded one, so this is not maintained by
  vigilance alone.
- **Prefer DOM construction over `innerHTML`.** Use `el()` + `textContent`.
  Static internal markup is fine; interpolating a stored value into HTML is not.
- **Media URLs and post URLs are different namespaces.** A permalink must never
  reach `player.src`; a CDN asset must never become an "open original post"
  link.
- **Touching `manifest.json` or a `<script>`/`<link>` means updating
  `build.sh`** in the same change. `tests/build.test.js` enforces it.

## Tests

```bash
npm test
```

438 tests, no dependencies beyond `node --test`. They load the real source into
a `vm` sandbox through a gated test seam (`globalThis.__SBE_TEST_HOOKS__`) that
is a no-op in the browser.

Seven suites exist specifically as compliance evidence and are worth keeping
green for that reason rather than only for correctness:
`capture-gate.test.js`, `message-validation.test.js`, `compliance.test.js`,
`legacy-cleanup.test.js`, `legacy-storage.test.js`, `url-sinks.test.js`,
`csp.test.js`, `import-flow.test.js`, `reproducible-build.test.js`,
`disclosure-consistency.test.js`, `icon-branding.test.js`.

They do **not** load the extension into Chrome. Content-script and UI changes
still need manual verification via `chrome://extensions/` and the DevTools
console (everything logs with an `[SBE]` prefix).

## Build

```bash
./build.sh
```

Produces `saved-posts-library-export-<version>.zip` with `manifest.json` at the
root, a byte-sorted entry list (so the hash is reproducible across machines), and nothing but runtime files inside, and prints its SHA-256.

## Third-party code

| Library | Version | License |
|---|---|---|
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | MIT or GPLv3 (dual) |

Bundled in `lib/`, not remotely loaded — Manifest V3 forbids remote code.

## License

MIT

## Support

If this is useful, you can
[support the developer on Patreon](https://www.patreon.com/join/THYProduction).
Entirely optional; the extension is fully functional without it and sends
nothing anywhere either way.
