# Tests

Zero-dependency unit tests using Node's built-in `node:test` runner. Run with:

```bash
npm test
# or, equivalently:
node --test tests/
```

Requires Node 18+ (uses `node:test` and the WHATWG `URL`).

## How it works

The extension source files (`injector.js`, `content.js`, `gallery.js`) are loaded into a sandboxed `vm` context with a stub-shaped browser environment (`document`, `chrome`, `window`, `Analytics`). For the IIFE files, a tiny test seam at the very tail of each file exposes internals only when `globalThis.__IG_EXPORTER_TEST_HOOKS__` is set — a no-op in the production browser.

```js
// content.js, end of IIFE
if (typeof globalThis !== 'undefined' && globalThis.__IG_EXPORTER_TEST_HOOKS__) {
  globalThis.__IG_EXPORTER_TEST_HOOKS__.content = { addImage, addVideo, ... };
}
```

The seam is gated and inert in the browser. If you delete it, the tests fail with a clear error pointing you at the missing hook.

`gallery.js` is a top-level script (no IIFE), so its function declarations and top-level vars become properties of the sandbox object directly — no seam needed.

## Coverage matrix vs `qa-v4.3.md`

| QA section | Test file | Manual still required? |
|---|---|---|
| 0. Pre-flight (console errors on real IG) | — | ✅ yes — needs a real Instagram tab |
| 1. Autoplay (real video element + IntersectionObserver) | — | ✅ yes — needs a real DOM and a real `<video>` |
| 2. Autoplay popup toggle (cross-tab propagation) | — | ✅ yes — needs `chrome.tabs` + multiple tabs |
| 3. Album mode — carousel grouping | `grouping.test.js`, `extraction.test.js` | partial (badge rendering still manual) |
| 4. Metadata display | `extraction.test.js`, `escape.test.js` | partial (DOM rendering still manual) |
| 5. Legacy data compatibility | `grouping.test.js` ("legacy items interleave") | partial (real upgrade path still manual) |
| 6. `build.sh` sanity | `build.test.js` | covered |
| 7. Regression — features | — | ✅ yes — UI flows |

The unit tests cover the **logic that's pure and pinning-worthy**: extraction across API shapes, dedup invariants, storage shape, grouping, HTML escaping, and the build pipeline. They will catch the kinds of regressions where someone refactors `getCurrentItems` and breaks carousel grouping, or someone adds a file to the manifest and forgets to update `build.sh`.

They will NOT catch: a CSS regression that makes the carousel badge invisible, a popup toggle that doesn't propagate to a second tab, autoplay broken by an Instagram DOM change, etc. Those need a browser.

## Files

- `_setup.js` — sandbox + loaders. Imported by every test file.
- `extraction.test.js` — `injector.js` metadata extraction (REST/GraphQL/XDT shapes, carousel propagation, recursion limit).
- `content-helpers.test.js` — `content.js` pure helpers: `extractHashtags`, `contextToOptions`, and the dedup-critical `normalizeUrl`.
- `storage-shape.test.js` — `addImage`/`addVideo`/`buildItem` field shape and dedup.
- `grouping.test.js` — `getCurrentItems` carousel grouping and capture-order preservation.
- `escape.test.js` — `escapeHtml` against XSS payloads.
- `build.test.js` — runs `./build.sh` in a temp dir, verifies the zip contents.

## Running a single file

```bash
node --test tests/grouping.test.js
```

## Pitfalls

- **Cross-realm equality**: objects/arrays returned from the sandbox have prototypes from the sandbox's realm, so `assert.deepEqual` will reject them. Compare field-by-field or use `JSON.stringify` on both sides.
- **The build test is slow** (~1s) because it runs the actual shell `build.sh` and `unzip`. The other tests are sub-100ms total.
- **The build test requires `unzip`** to be installed (it is on macOS and most Linux by default).
- **Sandbox is intentionally dumb**: stubs return null/empty for most DOM calls. If you write a test that needs a richer DOM, mock at the call site rather than enriching the shared sandbox.
