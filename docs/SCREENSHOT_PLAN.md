# Store screenshots — Saved Posts Library & Export v4.4.3

**Status: the six listing screenshots exist.** They are in
`assets/store-screenshots/`, generated on 2026-08-26 from the real 4.4.3 UI with
synthetic data. This document records how, what the rules were, and what is
still open.

---

## The set

Captured with the local Chrome 151 in headless mode against
`tools/screenshot-harness/`. Rerun the whole set with:

```bash
python3 tools/screenshot-harness/serve.py &
./tools/screenshot-harness/capture.sh
```

| File | Size | Shows | Reproduce |
|---|---|---|---|
| `01-popup-idle.png` | 1280×800 | Popup with a seeded library, version badge `v4.4.3`, Start capture / Gallery / Clear all data, and the "capture is off until you press Start" line | `/popup.html` |
| `02-first-run-disclosure.png` | 1280×800 | The full first-run consent dialog: all seven data categories named in bold, the never-asks-for-password/cookies/session-tokens/2FA sentence, Cancel and "I understand — enable capture" | `/popup.html?consent=0&act=disclosure` |
| `03-library.png` | 1280×800 | The Library populated with synthetic records — grid, per-item author and date, caption, the album badge, the always-visible non-affiliation notice | `/gallery.html` |
| `04-search.png` | 1280×800 | `@example_account` in the search box and the grid filtered to it: "Showing 3 of 9 items" | `/gallery.html?act=search` |
| `05-album-expanded.png` | 1280×800 | A carousel expanded inline — "4 SLIDES", the layered-sheets badge, the slide strip, Download album | `/gallery.html?act=album` |
| `06-videos-and-export.png` | 1280×800 | The Videos tab and the export controls: Download, Export All, Export CSV, Download all (zip), Import, Copy Videos, Clear All | `/gallery.html?act=videos` |

**All six frames are 1280×800**, which is what the Chrome Web Store accepts for
a listing screenshot (the alternative is 640×400).

The two popup frames get there in two steps, and the reason is worth recording
because the first attempt got it wrong. `popup.html` sets `width: 320px`, so
capturing it in a 440×720 browser window left the page pinned to the left with
~120px of dead space beside it and ~330px below — it read as a broken layout
rather than a popup. So `capture.sh` now captures the popup at exactly its own
width and a measured height, then `frame-popup.py` centres that on a 1280×800
ground in the product's neutral palette.

The two heights are measured, not guessed:

| Frame | Capture | Why |
|---|---|---|
| idle | 320×410 | Visible content ends at 385px. |
| disclosure | 320×455 | The consent card needs ~400px. `.about-overlay` is `position:absolute; inset:0` with `align-items:center`, so a card taller than its flex container overflows in *both* directions and the top is what gets clipped — a 410px canvas cut off the "Before you start" heading, and 440 still did. 455 is the smallest height that fits the whole card. |

`frame-popup.py` uses slate with a single soft teal glow. Its predecessor,
`compose_screenshots.py`, framed captures on `AURORA_PINK` / `AURORA_VIOLET` —
Instagram's own brand stops — under the headline "Export Instagram Saved Posts".
That script was deleted, and nothing in the new one reproduces it: no warm hue,
no gradient resembling Instagram's, and no headline text at all.

## What is in them, and what is not

Every frame satisfies, and was checked against, the rules below.

- **Real 4.4.3 UI.** The harness serves the shipped `popup.html`,
  `gallery.html`, `popup.js`, `gallery.js`, `tokens.css`, `url-allowlist.js` and
  `library-sanitize.js` unmodified. No markup was mocked up and no pixel was
  retouched.
- **Synthetic accounts only** — `@example_account`, `@placeholder_user`,
  `@demo_photos`, `@sample_studio`. No real username appears, the developer's
  included.
- **No real face, body, post or caption.** Every thumbnail is a locally
  generated abstract tile (rings, bands, dots, squares) in the product palette.
  Captions read "Sample caption for the screenshot — not a real post" and
  similar.
- **No Instagram logo, wordmark, glyph, gradient or brand asset**, and no
  capture of Instagram's own page chrome.
- **The current portrait icon**, shipped `assets/icons/icon-128.png` as-is,
  visible in frames 01 and 02. Not re-cropped, recoloured or regenerated *for
  the screenshot* — the frames are re-captured whenever the icon changes, which
  is why they were regenerated after the aspect-fit redesign. Frames captured
  before that redesign showed the superseded circular crop.
- **No testimonial, star rating, review or install count.**
- **Only functionality that exists in the 4.4.3 ZIP.** Slideshow interval
  controls and fullscreen are real (`gallery.js` §FULLSCREEN & SLIDESHOW);
  search, sort, album expansion, CSV/JSON export and ZIP download are real.
- **No claim of permanence or offline availability** anywhere in frame.

### One honest blemish, deliberately not hidden

Frame 06 shows the **Donate** button with an amber→teal gradient
(`#donate { background: linear-gradient(135deg, #f5af19, var(--accent)) }` in
`gallery.html`). `#f5af19` is not an Instagram brand colour and
`tests/compliance.test.js` passes, but it *is* a warm hue, which contradicts the
"teal/slate, no warm hues anywhere" wording used elsewhere in this repo. It is
left visible rather than cropped out. See `COMPLIANCE_EVIDENCE.md` finding OF-4:
the fix is a recolour in the next version, not an edited screenshot.

---

## What was deleted, and why

`assets/screenshots/screenshot-{1-popup,2-gallery,3-howto,3-videos,4-features}.png`
and `compose_screenshots.py` were **removed from the repository** in this
change. They are not merely unused:

1. **They contained real third-party personal data.** `screenshot-2-gallery.png`
   alone showed at least three identifiable Instagram usernames (`@d****e`,
   `@e***a.j***e.m***l`, `@l**a.b***e.bb`), photographs of identifiable people,
   and real post captions. Those people never consented to appearing in a store
   listing for a third-party extension. This was finding OF-3, and leaving the
   files in a public git repository was itself the problem — excluding them from
   bundles did not fix it.
2. **They showed the removed UI** — the pink/purple palette, the old product
   name, and version badges reading `v4.3.9`.
3. `compose_screenshots.py` framed those captures on a deliberate
   pink/violet "aurora" background (`AURORA_PINK = (225, 48, 108)`,
   `AURORA_VIOLET = (88, 81, 219)` — Instagram's own gradient stops) under the
   headline "Export Instagram Saved Posts". It has no non-infringing use and was
   replaced wholesale by `tools/screenshot-harness/`.

They were never packaged in the extension ZIP (`build.sh` copies an explicit
file list) and were excluded from every review bundle.

**Still on disk, not published, not deleted by this work:**
`assets/screenshots/raw/{gallery,popup,videos}.png` — the developer's own
original captures of their own account. They are gitignored, have never been
committed, and are the only copies, so they were left alone rather than
destroyed. They contain the same third-party usernames and faces. **Do not
publish them, and delete them locally once you no longer want them.**

`assets/og-image.png` never existed; the landing page referenced a file that was
never there. The stale `og:image` tag was removed rather than repointed.

---

## Promotional assets — still to do

Not produced by this work, and the only remaining screenshot-adjacent task:

- **Small tile / marquee.** Neutral teal/slate, the product name, and the
  portrait icon. No screenshot content, no Instagram brand asset. Do not add a
  verification tick, a badge, or anything that reads as an official
  endorsement — the portrait's job is to say "an independent person made this".
- **OG image**, only if one is actually wanted. Bound by every rule above. If
  you do not make one, leave the tag out, which is the current state and is
  better than referencing a file that does not exist.

---

## Rules for anyone regenerating these

- Do not composite a screenshot to show a feature working better than it does.
- Do not paste a real Instagram post into a mockup "just for illustration".
- Do not blur a real face and call it anonymised; do not include it at all.
- Do not add a caption to a screenshot that the listing copy would not be
  allowed to say in words.
- **Do not weaken the shipped allowlist to make a prettier screenshot.** The
  harness widens *its own copy* of `isAllowedMediaUrl` so local placeholder
  tiles render; `url-allowlist.js` is not edited and the shipped extension still
  accepts CDN hosts only. That distinction is the whole point — see
  `tools/screenshot-harness/README.md`.
