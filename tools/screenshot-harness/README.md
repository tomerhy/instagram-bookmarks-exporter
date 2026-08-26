# Screenshot harness

Renders the **real** `popup.html` and `gallery.html`, with the real
`gallery.js` / `popup.js`, in an ordinary browser tab so the Chrome Web Store
screenshots can be captured without a live Instagram account and without any
real person's data.

    python3 tools/screenshot-harness/serve.py        # http://127.0.0.1:8777/

It is a **build/marketing tool**. It is not part of the extension, is never
copied into `dist/`, and is never packaged — `build.sh` copies an explicit file
list and `tools/` is not on it.

## What it substitutes, and what it does not

Three substitutions, all confined to the harness, none of them touching a file
that ships:

1. **`chrome.*` is stubbed** (`harness-stub.js`) — `storage.local`,
   `runtime.getManifest`, `runtime.getURL`, `tabs.*`. Backed by an in-memory
   object seeded from `seed-library.json`. Nothing else about the pages changes.
2. **`SBE_URL.isAllowedMediaUrl` is *widened*** to also accept
   `http://127.0.0.1:<port>/media/…`, so the locally generated placeholder tiles
   actually render. The original function is called first and is not replaced;
   the widening is additive and exists only in the harness process.
   **`url-allowlist.js` itself is not edited.** The shipped allowlist stays
   CDN-only.
3. **Nothing else.** The markup, CSS, layout, palette, copy, icon and behaviour
   in the resulting screenshot are the shipped 4.4.3 ones.

Substitution 2 is the one worth being explicit about, because
`SCREENSHOT_PLAN.md` otherwise says not to weaken the allowlist for a prettier
screenshot. That rule is about the **product**. Widening a copy of the check
inside a throwaway local harness, so that placeholder images render instead of
broken-image glyphs, does not change what the extension will accept from a real
page. What the screenshot shows — a grid of thumbnails — is a real capability of
the real code.

## The synthetic data

`seed-library.json` contains invented accounts (`@example_account`,
`@placeholder_user`, `@demo_photos`, `@sample_studio`), invented captions that
say they are samples, and media URLs pointing at locally generated abstract
tiles. There is no real username, no real caption, no real post, no photograph
of any person, and nothing sourced from Instagram.

Regenerate the tiles with:

    python3 tools/screenshot-harness/make-placeholders.py
