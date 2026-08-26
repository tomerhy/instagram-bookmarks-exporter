# Compliance evidence — Saved Posts Library & Export

Prepared 25 August 2026 in response to:

| | |
|---|---|
| Removed item name | Instagram Saved Media Exporter |
| Chrome Web Store item ID | `hllpcahjefcijlmlnhlmhjemcgkgdgh` |
| Google case | 79-1827699 |
| Netcraft issue | 91984778 |
| Removed published version | 4.3.10 |
| Remediated version | **4.4.3** |
| Superseded | 4.4.1 and 4.4.2 — **neither approved for submission**. See §16 (4.4.2 changes) and §17 (why 4.4.2 was rejected and what 4.4.3 fixes). |

Nothing in this repository has been published, submitted, or appealed. The
package described below exists locally only.

---

## 0. Read this first — what was and was not verified

Being precise about this is the point of the document.

**Version 4.3.10 was located and audited at source level.** It exists in this
repository as annotated git tag `v4.3.10`, pointing at commit
`f3fccd56e4153ee6f14901f86a970658263836ae`, whose `manifest.json` reads
`"version": "4.3.10"`. That tree was extracted and inspected file by file.

**One limitation, stated plainly.** To use the exact form of words this
document is held to elsewhere: *source exported from annotated Git tag v4.3.10;
this is not a byte-verified copy of the package uploaded to the Chrome Web
Store.* The *published ZIP* for 4.3.10 could not be located — no release artifact for it exists in this repository, and the Chrome
Web Store copy is not retrievable now that the item is removed. Every 4.3.10
statement below therefore describes **the source at tag `v4.3.10`**, which is
the best available evidence but is not byte-proof that the uploaded package was
built from exactly that tree. Nothing here should be read as "the published
4.3.10 artifact was inspected", because it was not.

| Claim | 4.3.10 (source at tag) | 4.4.0 (repo HEAD before this work) | 4.4.1 (remediated) |
|---|---|---|---|
| Audited | Yes — source tree | Yes — source tree | Yes — source + built ZIP |
| Built ZIP hashed | No — no artifact exists | No | Yes (§2) |
| Tests executed against it | No — the suite has since changed | Baseline 268 passing | 4.4.1: 322/323 (1 deliberate failure). **4.4.2: 368/368, zero failures** (§16.5) |

Where a finding applies to both older versions it is marked **4.3.10 + 4.4.0**.

---

## 1. Audited versions and commits

| Version | Git object | `manifest.json` version |
|---|---|---|
| 4.3.10 | tag `v4.3.10` = `6e40b8ce7e3c17aaf6a323efbe8bd194561a1bec` → commit `f3fccd56e4153ee6f14901f86a970658263836ae` | `4.3.10` |
| 4.4.0 | commit `67237d79c68a6342d677a0340a4818de1b067c33` (branch `main` at start of work) | `4.4.0` |
| 4.4.1 | working tree on top of `67237d79` — **not committed**, so the diff is reviewable before anything lands | `4.4.1` |

Files **byte-identical** between 4.3.10 and 4.4.0, verified with
`git diff --quiet v4.3.10 HEAD -- <path>`:

- `injector.js` — the always-on MAIN-world interceptor. Unchanged for both versions.
- `privacy-policy.html` — the inaccurate policy. Unchanged for both versions.
- `assets/icons/icon-{16,32,48,128}.png` — same icons in both.
- `create-icons.html` — the generator that drew Instagram's camera glyph.

This matters for the appeal: the two behaviours most likely to have triggered
the report (always-on interception, and a privacy policy that contradicted the
code) were **identical in the removed version and in the version that followed
it**. They are fixed only in 4.4.1.

---

## 2. Final package (v4.4.3)

> Sections 1–15 of this document were written for earlier releases and are
> retained as **historical record**. Where a fact has changed, this section and
> §17 are authoritative. Anything below that names 4.4.1 or 4.4.2 as "final" is
> superseded.

| | |
|---|---|
| Path | `saved-posts-library-export-4.4.3.zip` (repository root) |
| Size | 144065 bytes |
| **SHA-256** | `91373ce6d3ce81e32d8d231de33105119dd416ef63b363bb972e358dcb975a90` |
| Files | 18 (no directory entries) |
| Built by | `./build.sh` |
| Reproducible | **Yes, across independent clean directories.** See §17.3 — the 4.4.2 claim was false and is now tested. |
| `manifest.json` at root | Yes |
| Test suite | **441 tests, 441 passing, 0 failing** |
| Git state | branch `v4.4.1-cws-remediation`, base commit `1fc354462f3092d8238089ec7d3b8c4f39a27635` (the 4.4.1 remediation). **All 4.4.2 and 4.4.3 work is uncommitted**, as instructed. No tag was created for 4.4.1, 4.4.2 or 4.4.3. |

Per-file SHA-256:

```
5dcbb236ad843fa77427c197da7df8cd8dee833558a1aa73bae26982d06add9d  assets/icons/icon-128.png
104a81f2ef956d115682e5c2a1bbb2a5cedd6d7ca63e790c7794f15b35615ef4  assets/icons/icon-16.png
f6e31c6dc30d4165e841d8e77ec71cac62861d4a73e2f9beb8818a37e56fd813  assets/icons/icon-32.png
d5f9d74a31a04c13b90bb8fc6de52b59739b1fcaf99276703c82857f615acb46  assets/icons/icon-48.png
50bd3f8a612c18e321f6585404482aa5224ca2fd77886c2da764f592d795ac30  background.js
fb24d1d5ab9f74bc677976a5b84460913a7060b84dc97ae5bd2eb5c4131d22e7  capture-hook.js
207e65e90be1d709329f554674d2539c210e8bfc657fbcb3a656b688fc9b73d4  content.js
f379b8ff5d735c4fc2832f005f78b7439fd93035fdb62a3d5252347596291339  gallery.html
b6d3e6ce9dd9d0d9426b2dd6cab4eb5bc0e13d8c19bb1895fb9582a4abefd719  gallery.js
b24af7e2af122dcbfb16739d4841c271253d938f9b4940d06092cdb9f5b4c1b7  legacy-cleanup.js
acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e  lib/jszip.min.js
5911b3bbb9c45abe9d9b17b895d4647d49e0b2ac2030a3e43ec5bfb01f2a29f0  library-sanitize.js
e4d0cb546fbb0661ecf74819a47487b31a731160a72fccc4254529d3d780d0c8  manifest.json
521df2af71eb9f715e6503ac2d26fe6254f07a3ee80f19c7da03a89326f689e1  popup.html
ccc64996e8ed62055f614bd93379af9253dfd909658c01171ea6920520ef25fa  popup.js
9a95061b41a43599c473dd312d002d0717b91c5dba4a10ed14f3e5eed35fdb5a  privacy-policy.html
7ba96e7f53dcabae3ebfad6ef71e950d768e5f37e9382ce0748889256a08871f  tokens.css
578b3a513c055ea4e5ac7f9139df7e16e6908d541648b02d0fd29ddfd5185834  url-allowlist.js
```

Absent from the package, and asserted absent by `tests/build.test.js`:
`analytics.js`, `autoplay.js`, `injector.js`, `content-styles.css`,
`assets/icons/portrait-source.png`, `assets/icons/icon-source.png`,
`assets/icons/maker.png`, `assets/screenshots/`, `tools/`, `tests/`,
`.claude/`, `.git/`, `.venv/`, `node_modules/`, `package.json`, `index.html`,
`README.md`, `*.md`, `*.map`, `.DS_Store`.

## 2a. Superseded artifacts, for the record

| Version | Artifact | SHA-256 | Status |
|---|---|---|---|
| 4.4.1 | `saved-posts-backup-export-4.4.1.zip` | `1ade0a8db533d5a38e578ed7ac32627805d4d887879c812e7aec52feca51ab1e` | **Rejected.** Open finding OF-1 was scoped too narrowly; shipped with a deliberately failing test. |
| 4.4.2 | `saved-posts-library-export-4.4.2.zip` | `05443bdae745bc1960097ead3afb8be1f7f5cb44ffdaa045039ce0ee553e7fea` | **Rejected.** Broken JSON import, incomplete change detection, false reproducibility claim, false privacy answers. See §17. |

Neither should be uploaded. Both hashes are recorded so a reviewer holding an
older bundle can tell immediately which artifact they have.

---

## 3. Permission table

### 4.4.1 — what is requested and where it is used

| Permission | Used in | Why it is required |
|---|---|---|
| `storage` | `content.js` (`saveToStorage`, `loadFromStorage`), `background.js` (badge state), `popup.js` (counts, consent, preferences), `gallery.js` (library read/write), `legacy-cleanup.js` (removing autoplay keys) | The captured library and all preferences live in `chrome.storage.local`. This is the extension's only data store. Without it there is no backup. |
| `unlimitedStorage` | Implicit — raises the quota for every `chrome.storage.local.set` above | Chrome's default local-storage quota is ~10 MB. A library of several thousand records carrying captions (up to 2,200 chars each) and album metadata can exceed it, and a `QUOTA_BYTES` failure mid-capture loses the user's work. **This permission grants no data access and shows no user-facing permission warning — it only raises a size limit.** It is the one permission that is arguably droppable; see §13 for the trade-off if a reviewer prefers it removed. |
| `https://www.instagram.com/*`, `https://instagram.com/*` (host) | `manifest.json` `content_scripts.matches`; `popup.js:~285` reads `tab.url` to decide which popup screen to show | Content scripts must run on the saved-posts pages. Host access also makes `tabs.Tab.url` readable for those tabs, which is how the popup distinguishes "you're on the right page" from "open your saved posts first". Scoped to exactly two host patterns. |

### Removed in 4.4.1

| Permission | Present in | Why it was removed |
|---|---|---|
| `activeTab` | 4.3.10 + 4.4.0 | Redundant. Everything it was there for is already covered by the explicit `instagram.com` host permissions: `tabs.Tab.url` is readable for a tab the extension has host access to, and `chrome.tabs.sendMessage` to the extension's own content script needs no additional permission. **Requires manual browser confirmation — see §13.** |
| `https://www.google-analytics.com/*` (host) | 4.3.10 + 4.4.0 | The only thing that used it was `analytics.js`, which is deleted. |

### Never requested, in any version

`cookies`, `webRequest`, `webRequestBlocking`, `declarativeNetRequest`,
`declarativeNetRequestWithHostAccess`, `history`, `identity`, `debugger`,
`management`, `nativeMessaging`, `proxy`, `privacy`, `browsingData`,
`topSites`, `bookmarks`, `downloads`, `clipboardRead`, `geolocation`,
`tabCapture`, `desktopCapture`, `pageCapture`, `contentSettings`, `tabs`,
`scripting`, `webNavigation`, `<all_urls>`.

Enforced by `tests/compliance.test.js` → *"manifest requests no credential-,
tracking- or privilege-related permission"*.

### CDN hosts are deliberately **not** requested

The gallery fetches the user's own media from `*.cdninstagram.com` /
`*.fbcdn.net` when they press Download or a ZIP button. Those hosts are **not**
in `host_permissions`; the fetches are ordinary CORS requests that succeed only
because the CDN itself serves permissive headers for images. Videos generally do
not, which is why the single-video Download path opens a tab for the browser to
save instead. Adding the CDN hosts would make video ZIPs more reliable, at the
cost of two more host permissions — the minimum-permission choice was taken
instead. This is a known functional limitation, not an oversight.

---

## 4. Content scripts and execution worlds

### 4.3.10 + 4.4.0

| File | World | `run_at` | Behaviour |
|---|---|---|---|
| `injector.js` | **MAIN** | `document_start` | Replaced `window.fetch` and `XMLHttpRequest.prototype.{open,send}` **unconditionally on every page load**, parsed every `/api/`, `graphql`, `/media/`, `/info`, `/p/`, `/reel/` response, and forwarded extracted media via `postMessage(..., '*')`. Never uninstalled. |
| `content.js` | isolated | `document_idle` | Received those messages and stored them. In **4.3.10 only**, it *also* patched `fetch` and `XHR` a second time (`content.js:1206–1286` at that tag) — two independent interception points. Removed in 4.4.0. |
| `autoplay.js` | isolated | `document_idle` | Unrelated video-autoplay feature. Present in the manifest of **both** versions. (The repository's `CLAUDE.md` described it as unreferenced dead code; that was stale — `manifest.json:40` listed it in both 4.3.10 and 4.4.0.) |
| `content-styles.css` | isolated | — | Stylesheet for the in-page floating panel. Dead in 4.4.0 (zero `ig-exp-` class users remained) but still injected into every Instagram page. |

### 4.4.1

| File | World | `run_at` | Behaviour |
|---|---|---|---|
| `url-allowlist.js` | **MAIN** + isolated | `document_start` / `document_idle` | Shared URL allowlist. Pure functions, no side effects, no network. |
| `capture-hook.js` | **MAIN** | `document_start` | **Installs nothing at load.** Waits for an `SBE_CAPTURE_CONTROL` message. On `start` it wraps `fetch`/XHR; on `stop` it restores them, and only if they are still its own wrappers. |
| `content.js` | isolated | `document_idle` | Owns all state and storage. Drops every inbound message unless capture is active, then validates sender, origin, envelope shape, and every field. |

`autoplay.js` and `content-styles.css` are deleted.

---

## 5. Outbound network destinations

Complete table for **4.4.1**. Enforced by `tests/compliance.test.js` → *"only
documented external hosts appear in shipped source"*, which fails if any new
host appears.

| Host | Reached by | Trigger | Data sent | Present in 4.3.10/4.4.0 |
|---|---|---|---|---|
| `*.cdninstagram.com` | `gallery.js` `fetch()` ×2 (album ZIP, library ZIP), ×1 (single image download) | User presses Download / Download album / Download library | Nothing beyond the GET for the media file itself | Yes |
| `*.fbcdn.net` | same as above | same | same | Yes |
| `www.instagram.com` | `window.open()` for a post permalink; content-script host scope | User clicks through to a post | Nothing | Yes |
| `buymeacoffee.com` | `popup.js:~57` `chrome.tabs.create` | User clicks the donation link | Nothing | Yes |
| `www.patreon.com` | `gallery.js` `window.open` | User clicks Donate | Nothing | Yes |
| `developer.chrome.com` | `<a href>` in `privacy-policy.html` | User clicks the policy's User Data Policy link | Nothing | No — new in 4.4.1 |
| `www.w3.org` | SVG namespace URI in inline `<svg xmlns=...>` | Never fetched — it is an XML namespace identifier, not a URL | None | Yes |
| ~~`www.google-analytics.com`~~ | ~~`analytics.js:51` `fetch()` POST~~ | **Automatic**, on every popup/gallery open and every button click | **Persistent client ID, session ID, event name, button name, feature name, error name, item counts** | **Yes — removed in 4.4.1** |

**There is no developer-operated server in any version.** The only telemetry
endpoint that ever existed was Google Analytics.

---

## 6. Data-flow description (4.4.1)

```
                      instagram.com page (MAIN world)
                                  |
       [1] user presses Start capture in the popup
                                  |
   popup.js --chrome.tabs.sendMessage--> content.js (isolated world)
                                  |
       [2] content.js reads sbeConsentAcceptedAt from chrome.storage.local
           - absent -> replies consent_required, popup shows the disclosure,
                       NOTHING is captured
           - present -> captureActive = true
                                  |
       [3] content.js --window.postMessage(SBE_CAPTURE_CONTROL/start)-->
           capture-hook.js, which NOW wraps window.fetch + XHR
                                  |
       [4] content.js scrolls the page; Instagram loads the next slice of the
           user's own saved feed using its own networking
                                  |
       [5] capture-hook.js reads those already-received response bodies,
           extracts media + post metadata, drops any URL failing the
           allowlist, and posts SBE_MEDIA to the page origin
                                  |
       [6] content.js re-validates: event.source === window, origin in
           {https://www.instagram.com, https://instagram.com}, envelope shape,
           item types, URL allowlist, field-by-field clamping, batch cap,
           record ceiling
                                  |
       [7] surviving records -> chrome.storage.local['igExporterData']
                                  |
       [8] user presses Stop (or the feed ends, or the page reloads):
           captureActive = false; capture-hook.js restores fetch/XHR
                                  |
       gallery.js reads chrome.storage.local directly and renders.
       Media bytes are fetched from the CDN in two situations: automatically
       when the library renders a thumbnail or preview, and explicitly when the
       user presses Download or a ZIP button. (Corrected in 4.4.3 — the earlier
       wording ~~only on an explicit Download~~ understated it.)
```

The only traffic this flow produces is the browser fetching the user's own
media from Instagram/Meta's CDN — automatically when a thumbnail or preview is
rendered, and on an explicit click for downloads. The captured library itself
is not transmitted anywhere.

**No request is ever constructed against a private Instagram API.** The reader
only inspects response bodies for requests the page itself made. There is no
code path that builds an Instagram API URL and fetches it.

---

## 7. Credential-access findings

Searched across all shipped files in **all three versions**. Result: **no
credential access in any version.**

| Sought | 4.3.10 | 4.4.0 | 4.4.1 |
|---|---|---|---|
| Password field / read | none | none | none |
| Login form / imitation login UI | none | none | none |
| `document.cookie` | none | none | none |
| `chrome.cookies` | none | none | none |
| `csrftoken` / `sessionid` / `x-csrftoken` | none | none | none |
| `Authorization` header access | none | none | none |
| Bearer / OAuth token handling | none | none | none |
| 2FA / OTP capture | none | none | none |
| `webRequest` header interception | permission not requested | not requested | not requested |
| `chrome.identity` | none | none | none |
| Keystroke logging | none | none | none |
| Browser history access | none | none | none |

`url-allowlist.js:38` contains the only occurrence of the word `password` in
shipped code, in `if (u.username || u.password) return null;` — it **rejects**
URLs carrying embedded credentials. Asserted positively by
`tests/compliance.test.js` → *"the URL allowlist rejects credentials embedded in
a URL"*.

**The "no credential collection" statement is truthful and defensible for all
three versions.** See §13 for the one caveat about what the phishing report may
actually have been reacting to.

---

## 8. Remote-code findings

| Sought | 4.3.10 | 4.4.0 | 4.4.1 |
|---|---|---|---|
| `<script src="http…">` | none | none | none |
| Remote `<link>` / `@import` | none | none | none |
| `eval()` | none | none | none |
| `new Function()` | none | none | none |
| Dynamic `import()` | none | none | none |
| `importScripts()` | none | none | none |
| String-argument `setTimeout` | none | none | none |
| `chrome.scripting.executeScript` | permission not requested | not requested | not requested |

All code is contained in the package. Manifest V3 compliant.

Third-party library inventory (identical in all versions except that 4.3.10 did
not bundle it):

| Library | Version | File | License | Notes |
|---|---|---|---|---|
| JSZip | 3.10.1 | `lib/jszip.min.js` | MIT **or** GPLv3 (dual) | Bundled, not remote. Includes pako (MIT). License header retained in the file. Added in 4.4.0 for the album/library ZIP features. |

No other third-party code. No framework, no bundler, no package dependencies —
`package.json` exists only so `npm test` works and declares zero dependencies.

---

## 9. Local-storage inventory (4.4.1)

### `chrome.storage.local`

| Key | Written by | Contents |
|---|---|---|
| `igExporterData` | `content.js`, `gallery.js`, `popup.js` | `{ images: [...], videos: [...] }`. Each record: `type`, `url`, `thumbnail`, `postUrl`, `postShortcode`, `carouselIndex`, `carouselSize`, `metadata: { caption, owner, takenAt, likeCount, hashtags }`, `scrapedAt`. Key name kept from earlier versions so upgrading users keep their library. |
| `igExporterLastSeenAt` | `popup.js`, `gallery.js`, `background.js` | Epoch ms of the last time the user looked. Drives the "new since last visit" badge. |
| `sbeConsentAcceptedAt` | `popup.js` | Epoch ms the first-run disclosure was accepted. Read by `content.js` before every start. Deleted by Clear all data. |
| `sbeLegacyCleanupAt` | `legacy-cleanup.js` | Epoch ms the legacy-telemetry sweep first completed. Audit marker; written once. |
| `useCount` | `popup.js` | Integer; gates the donation banner at 15 uses. |
| `supportDismissed` | `popup.js` | Boolean; the user dismissed the donation banner. |

### `localStorage` / `sessionStorage`

**Nothing is written in 4.4.1.** The only Web Storage code that remains is
`legacy-cleanup.js`, which *removes* keys.

| Key | Written by | Status |
|---|---|---|
| `ga_client_id` | `analytics.js` (≤ 4.4.0) — persistent pseudonymous analytics ID | **Deleted on first run of 4.4.1** |
| `ga_debug` | `analytics.js` (≤ 4.4.0) — debug opt-in | **Deleted on first run of 4.4.1** |
| `ga_session_id` | `analytics.js` (≤ 4.4.0), sessionStorage | **Deleted on first run of 4.4.1** |
| `igAutoplayEnabled`, `igAutoplayMuted` | `autoplay.js` / `popup.js` (≤ 4.4.0) | **Deleted on first run of 4.4.1** |

Verified by `tests/legacy-cleanup.test.js` (9 tests), including idempotence and
survival of a `SecurityError` from a policy-disabled Web Storage.

---

## 10. Security test results

`npm test` → **323 tests, 323 passing, 0 failing.** Baseline before this work
was 268 passing (against the old file set).

| Suite | Tests | What it proves |
|---|---|---|
| `capture-gate.test.js` | 14 | Capture inactive on load; nothing patched on load; **no storage write at load time**; valid media dropped while off and accepted while on; consent only granted by a positive numeric stamp; Start signals install; Stop drops the gate and signals uninstall; **Stop restores `fetch` and both XHR methods exactly**; Stop leaves a third party's later wrapper alone; double Start does not double-wrap; media landing after Stop is discarded; Clear All wipes state including the dedup set |
| `message-validation.test.js` | 23 | Rejects foreign `event.source`; rejects 5 unexpected origins incl. `http://` and `instagram.com.evil.example`; accepts both real origins; 13 malformed envelopes rejected without throwing; 11 malformed items dropped; a good item survives a junk batch; **20 hostile URLs rejected** (`javascript:`, `data:`, `blob:`, `file:`, `chrome-extension:`, `chrome:`, `about:`, `http:`, localhost, `127.0.0.1`, `[::1]`, third parties, `evilcdninstagram.com`, `cdninstagram.com.evil.example`, embedded credentials, protocol-relative); 4 real CDN shapes accepted; hostile thumbnail stripped without losing the item; caption clamped; owner/shortcode pattern-checked; NaN/Infinity/negative/string numerics rejected; index range enforced; batch capped; record ceiling holds; reader-side URL filtering; **depth limit, cycle safety, result cap**; import drops 6/7 hostile records; imported objects cannot smuggle extra properties |
| `compliance.test.js` | 25 | Removed files absent; **zero `Analytics` references**; zero GA endpoints/IDs/secrets; the two specific GA credentials absent; no beacon/WebSocket/EventSource; legacy keys referenced only by the cleanup; exactly two permissions; **27 forbidden permissions absent**; host scope exactly two patterns, no wildcards; MAIN-world entry is exactly the reader + allowlist; MV3 with no remote-code manifest keys; name carries no affiliation claim and no "official/approved/endorsed/best"; **no cookie/token/password/auth-header read**; credentialed URLs rejected; no `<form>` or password field on any page; only two inputs exist anywhere; policy page is inert static HTML; no remote script/stylesheet/`@import`; no `eval`/`new Function`/`import()`; **only documented hosts appear**; CDN allowlist is exactly two suffixes; no Instagram brand hex or rgb() survives; disclaimer present in popup + gallery + policy; no download filename is Instagram-branded; every `innerHTML` assignment is escaped or static |
| `legacy-cleanup.test.js` | 9 | GA client ID, debug flag and session ID removed; autoplay prefs removed; unrelated keys untouched; idempotent; marker written exactly once; survives Web Storage `SecurityError`; survives a dead extension context; loaded by both pages |
| `build.test.js` | 5 | Zip is produced; contains every manifest/HTML-referenced file; contains no dev artifacts or removed files; **`manifest.json` is at the zip root**; every manifest reference exists on disk |
| `escape.test.js` | 10 | `escapeHtml` pins all five HTML-significant characters, with no second-order escape bugs |
| `extraction.test.js` | 25 | Metadata extraction across REST v1, GraphQL and XDT shapes — now against allowlisted CDN fixtures |
| Others (`content-helpers`, `storage-shape`, `clear-sync`, `clear-viewer`, `context-guard`, `badge`, `search`, `sort`, `grouping`, `carousel-expand`, `csv-export`, `export-import`, `album-zip`, `library-zip`) | 212 | Pre-existing functional coverage, still green |

### What the tests do **not** cover

The suite runs in Node against a stubbed browser. It does not load the
extension into Chrome. The following need manual verification and are listed in
§13 rather than being claimed here:

- That late `fetch` patching still intercepts Instagram's requests in the real page.
- That the popup still detects an Instagram tab after `activeTab` was dropped.
- That the consent modal and the new palette render correctly.

---

## 11. Static search results

Commands run from the repository root against the shipped file set.

### Analytics / telemetry

```
grep -n 'google-analytics\|googletagmanager\|G-[A-Z0-9]\{8,\}\|UA-[0-9]\{4,\}\|api_secret\|measurement_id\|mp/collect' <shipped files>
```
→ **No matches in code.** Two matches in `privacy-policy.html` prose and one in
a `legacy-cleanup.js` comment, both of which *document the removal*. Retained
deliberately; the compliance test excludes prose and strips comments for this
reason.

```
grep -n 'Analytics' <shipped code>          → no matches
grep -n '<measurement-id>\|<api-secret>'    → no matches anywhere in the repo
grep -n 'sendBeacon\|new WebSocket\|new EventSource'  → no matches
```

### Credentials

```
grep -n 'document.cookie\|chrome.cookies\|csrftoken\|sessionid\|x-csrftoken\|Authorization\|bearer'  → no matches
grep -n 'type=.password\|autocomplete=.*password'                                                    → no matches
grep -n '<form'                                                                                       → no matches
```

### Remote code and dynamic evaluation

```
grep -n 'eval(\|new Function\|import(\|importScripts\|<script[^>]*src="http\|<link[^>]*href="http'   → no matches
grep -rn 'sourceMappingURL' <unpacked zip>                                                            → no matches
```

### External endpoints

```
grep -oE 'https?://[^ "'\'']+' <shipped files> | sed 's#\(https\?://[^/]*\).*#\1#' | sort -u
```
→ `www.instagram.com`, `instagram.com`, `buymeacoffee.com`, `www.patreon.com`,
`developer.chrome.com`, `www.w3.org` (namespace URI). Nothing else.

### Branding

```
grep -iE '#(E1306C|833AB4|C13584|5851DB|405DE6|FD1D1D|F77737|FCAF45|FCB045|E4405F)' <shipped files>
grep -iE 'rgba?\((225,48,108|131,58,180|193,53,132|88,81,219|64,93,230|253,29,29)'  <shipped files>
```
→ **No matches** outside a `tokens.css` comment that records which values were
removed. 33 `rgba()` occurrences and 5 hex/gradient occurrences were replaced.

```
grep -n 'a.download' gallery.js
```
→ `saved-posts-library-*.zip`, `saved-post_*.jpg`, `saved-posts-export-*.json`,
`saved-posts-*.csv`, `<shortcode>.zip`. No `instagram-*` filename remains.

---

## 12. Findings, and how each was addressed

Numbering follows the brief. Severity is this audit's own judgement.

| # | Finding | Applies to | Severity | Status in 4.4.1 |
|---|---|---|---|---|
| 1 | Privacy policy claimed nothing is transmitted and no analytics is used | 4.3.10 + 4.4.0 | **Critical — false statement to users** | Policy rewritten from scratch; the discrepancy is disclosed by name in a "Change history" section rather than quietly dropped |
| 2 | `analytics.js` sent a persistent client ID and usage events to GA4 | 4.3.10 + 4.4.0 | **Critical** | File deleted; ~95 call sites removed; measurement ID and API secret removed; leftover IDs deleted from users' browsers |
| 3 | `google-analytics.com` in `host_permissions` | 4.3.10 + 4.4.0 | High | Removed |
| 4 | Policy listed `tabs` + `scripting`; manifest actually used `storage`, `unlimitedStorage`, `activeTab` | 4.3.10 + 4.4.0 | High | Policy now lists exactly what the manifest requests; `activeTab` also removed as unnecessary |
| 5 | Policy said "only media URLs"; code stored owners, captions, timestamps, like counts, hashtags, post URLs, capture times | 4.3.10 + 4.4.0 | **Critical — materially understated collection** | Policy now enumerates all ten categories in a table, with why each is stored |
| 6 | MAIN-world `injector.js` replaced `fetch`/XHR at `document_start`, always | 4.3.10 + 4.4.0 | **Critical — the core issue** | Rewritten as `capture-hook.js`: installs nothing until an explicit Start, uninstalls on Stop, and only restores wrappers that are still its own |
| 7 | API/GraphQL responses parsed before any user action | 4.3.10 + 4.4.0 | **Critical** | Double-gated: the reader is not installed, and `content.js` discards messages while `captureActive` is false |
| 8 | `content.js` accepted `IG_EXPORTER_MEDIA` and stored it | 4.3.10 + 4.4.0 | High | Message type renamed; sender, origin, envelope, item types, URL allowlist and every field now validated; batch and record caps added |
| 9 | Unrelated autoplay feature (single-purpose violation) | 4.3.10 + 4.4.0 — **and it was wired into the manifest in both**, contrary to the repo's own notes | High | `autoplay.js` deleted, manifest entry removed, popup toggle removed, its tests removed, its stored prefs cleaned up |
| 10 | Name, icon, colours, UI, filenames and description implied affiliation | 4.3.10 + 4.4.0 | **Critical — the trademark complaint** | Renamed; new neutral teal/slate icons; whole palette de-branded; album glyph replaced; filenames renamed; disclaimer added in three places |
| 11 | No credential collection found | all versions | — | Confirmed, and now regression-tested |
| 12 | No publisher-controlled data server | all versions | — | Confirmed; GA was the only endpoint, and it is gone |
| 13 | Package was 4.4.0, not the removed 4.3.10 | — | — | 4.3.10 located as a git tag and audited at source; the published ZIP could not be located (§0) |

### Additional findings this audit surfaced, not in the brief

| Finding | Applies to | Severity | Status |
|---|---|---|---|
| **`create-icons.html` drew Instagram's mark directly** — a rounded square with the pink/orange/purple gradient, a white circular "camera lens" and a flash dot. Committed to the repository as the icon generator the README pointed users at. | 4.3.10 + 4.4.0 | **High — direct trade dress copying** | File deleted; replaced by `tools/make-icons.py`, which draws a neutral archive tray + download arrow |
| **The shipped icon was a photograph of the developer's face** on a pink-magenta gradient (`icon-{16,32,48,128}.png`, `icon-source.png`), plus `maker.png` in a hidden "about the maker" popup card. | 4.3.10 + 4.4.0 | Medium — not impersonation, but personal data in the package and Instagram-adjacent colour | All replaced with generated neutral icons; `maker.png` deleted; the About card is now product info + the disclaimer |
| **`gallery.html` used a copy of Instagram's album glyph** — two offset rounded squares — with a source comment saying so. | 4.4.0 | Medium | Replaced with a neutral layered-sheets glyph |
| **`Import` accepted arbitrary URLs** into storage with no validation; those records were later `fetch()`ed, rendered as `<img src>`, and opened in tabs. A crafted JSON file could point the gallery at any URL. | 4.3.10 + 4.4.0 | **High** | `sanitizeImportedItem`/`sanitizeImportedList` rebuild every record field by field through the allowlist; the fetch and open sites are independently guarded |
| **Unreachable-but-live capture paths bypassed every gate.** `captureModalImages()` wrote straight into state from the DOM; `clickCarouselPost()`/`closeModal()` simulated clicks through post modals; `captureSelected()` was a second capture entry point. All were unreferenced from any UI, but all were live code. | 4.4.0 (and in 4.3.10 as reachable code) | Medium | ~385 lines removed: the whole selection-mode subsystem, the modal DOM-scraper, and the click-simulation helpers |
| **`content-styles.css` was injected into every Instagram page while being entirely dead** (zero users of its `ig-exp-*` classes remained after the panel was deleted in 4.4.0) — and it carried three Instagram-gradient rules. | 4.4.0 | Low | Deleted; removed from the manifest |
| **`--ig-card` was referenced in `gallery.html` but never defined**, so that rule silently did nothing. | 4.4.0 | Low (cosmetic bug) | Pointed at `--surface-1` |
| **`postMessage` used `'*'` as the target origin**, broadcasting extracted media to any listener in the page. | 4.3.10 + 4.4.0 | Medium | Both directions now post to `window.location.origin` |
| **Recursion had a depth limit but no result cap and no cycle protection** in `extractMediaFromData`. | 4.3.10 + 4.4.0 | Low | Depth lowered to 12, result cap of 400 per response added, cycle safety tested |
| **`assets/screenshots/*.png` are real captures of Instagram's UI**, used as store listing assets. | 4.3.10 + 4.4.0 | Medium — listing risk | Not shipped in the zip (never were), but flagged: they must be recaptured before resubmission. See §13. |
| **`index.html` is a live GitHub Pages landing page** (`og:url` = `https://tomerhy.github.io/instagram-bookmarks-exporter/`) carrying the old product name, Instagram's pink/purple gradient, and a screenshot of Instagram's UI. It is outside the extension package, but it is publicly reachable and findable by the same scanners that produced the report. | 4.3.10 + 4.4.0 | **High — live trademark exposure** | Renamed, repalletted to the extension's teal/slate, disclaimer added in the footer, alt text de-branded. **The deployed copy must be republished — see §13.** |
| **`index.html` published three fabricated testimonials as genuine user reviews** — named authors ("Sarah M.", "Jake T.", "Maria L."), job titles, five-star ratings, under the heading "Loved by Instagram Users" and "Join thousands who've saved their favorite content". One of them praised a "selection feature" that was **unreachable dead code in every shipped version**, so it cannot have been real user feedback. | 4.3.10 + 4.4.0 | **High — deceptive practice, independent of the trademark issue** | Section removed, with an HTML comment in place recording why. This was a judgement call made during remediation, not something the brief asked for: publishing invented reviews is its own policy problem and would undermine any appeal that argues the developer is acting in good faith. If any quote is genuine, restore it with real attribution. |

---

## 13. Remaining risk

Listed because omitting any of it would make this document less useful, not
more.

### Requires manual verification in Chrome

> **Updated 2026-08-26 — items 1, 2 and 3 are now closed.** They were written
> when no browser run existed. The developer executed
> `MANUAL_CHROME_TEST_PLAN.md` in Chrome on 2026-08-26 and reported every
> ⚠ BLOCKER passing, with capture yielding at least 288 images and 99 videos.
> That result is **developer-performed and developer-reported**, not
> independently reproduced here — see §19. The original wording of each item is
> kept below so the risk that was being tracked stays legible.

1. ~~**Late `fetch` patching may miss requests.**~~ **CLOSED 2026-08-26** —
   §7 of the manual plan reported ≥288 images and ≥99 videos in one session.
   Yield did not collapse; the trade-off held. Original text: **Late `fetch`
   patching may miss requests.** This is the most important open
   risk. Wrapping `window.fetch` at Start instead of at `document_start` only
   intercepts calls that resolve `fetch` at call time. If Instagram's bundle
   captured a reference to `fetch` earlier in page load, those calls will no
   longer be seen and capture yield will drop. XHR is safe (prototype lookup
   happens per call), and the design deliberately accepts this trade because
   off-by-default is the compliance requirement. **Load the extension, capture a
   saved feed, and compare the item count against 4.4.0 before resubmitting.**
   If yield is materially worse, the honest fix is a visible in-page indicator
   plus patching at `document_start` *only after* consent has been recorded —
   not a silent return to always-on.

2. ~~**`activeTab` removal.**~~ **CLOSED 2026-08-26** — §12 reported the popup
   detecting the Instagram tab, showing the fallback elsewhere, and reaching the
   content script, all without `activeTab`. It stays out of the manifest.
   Original text: **`activeTab` removal.** The popup reads `tab.url` to decide which screen to
   show. Chrome supplies `Tab.url` when the extension has either the `tabs`
   permission or host access to that tab, and we have host access to
   `instagram.com`. Messaging the extension's own content script needs no extra
   permission. I am confident but could not execute it: **confirm the popup
   still shows the capture controls on an Instagram tab, and still reaches the
   content script.** If it regresses, restore `activeTab` and justify it.

3. ~~**Consent modal and palette rendering.**~~ **CLOSED 2026-08-26** — §5 and
   §13 reported the disclosure appearing before any capture with all seven
   categories named, and the Library rendering in the teal/slate palette with
   the non-affiliation disclaimer visible. Modal *focus handling* specifically
   was not called out in the report and is not claimed as verified.

### Chrome Web Store risk

4. **Prior false statements are on the record.** The removed version's policy
   asserted no transmission and no analytics while shipping GA. Even fully
   remediated, a reviewer may weigh that history. The right posture is the one
   taken in `CWS_PRIVACY_DISCLOSURES.md` §7: disclose it first, in the
   developer's own words.

5. **A MAIN-world content script that wraps `fetch` remains inherently
   scrutinised**, even gated. Expect questions. The defensible answer is that
   the wrapper is inert until a click, is removed on Stop, reads only responses
   the page already received, constructs no requests, and that the isolated
   world independently re-validates everything.

6. **Store assets are not yet compliant.** `assets/screenshots/*.png` show
   Instagram's UI in the old pink/purple design. They are not in the package,
   but they are the listing images. Recapture before submitting
   (`CWS_STORE_LISTING.md` has the constraints).

6a. **The landing page must be redeployed.** `index.html` was remediated in this
   repository, but the *published* GitHub Pages copy at
   `https://tomerhy.github.io/instagram-bookmarks-exporter/` still serves the
   old branding and the fabricated testimonials until it is republished. This is
   the single highest-value remaining action after the package itself: it is
   public, indexed, and directly contradicts the appeal. Note also that the
   repository name itself (`instagram-bookmarks-exporter`) appears in the URL
   and in `og:image`; renaming the repository would remove that too, at the cost
   of breaking existing links.

7. **`unlimitedStorage` is the one permission a strict reviewer might push
   back on.** It can be dropped: the record caps in `content.js` (`LIMITS`)
   already bound growth. The cost is a hard ~10 MB ceiling, after which a large
   library fails to save. Recommend keeping it with the §3 justification.

8. **Residual repository branding.** `index.html` (a marketing landing page)
   and `README.md` still carry the old name in places, and `STORE_LISTING.md`
   is the superseded listing. None of these are in the package, but if
   `index.html` is deployed anywhere public it is a live trademark exposure.
   Updated where cheap; **verify nothing stale is published.**

### Instagram Terms of Use risk

9. **This risk is not eliminated and cannot be.** Automated scrolling to
   trigger the site's own loading, and bulk local retention of post content,
   may conflict with Instagram's Terms of Use regardless of Chrome Web Store
   compliance. The extension does not bypass authentication, access controls,
   paywalls, or restrictions, and reads nothing the signed-in user cannot
   already see — but "does not violate CWS policy" is not "is permitted by
   Instagram". The listing and policy now state that the user is responsible
   for their own use of the site. A takedown request from Meta remains possible
   on Terms grounds even if the store reinstates the item.

10. **Third-party content.** A user's saved posts are other people's
    copyrighted material. The extension stores it locally for personal backup
    and the policy says so, but redistribution is the user's responsibility.

### Nothing found that blocks a truthful "no credential collection" statement

No password, cookie, session-token, auth-header, or 2FA access exists in any of
the three versions, and no login UI is displayed or imitated. One nuance worth
volunteering rather than waiting to be asked: **the pre-4.4.1 always-on
`fetch`/XHR interception is the behaviour most likely to have produced a
phishing signal.** An automated scanner seeing an extension replace `fetch` at
`document_start` on a login-bearing domain and forward parsed response data over
`postMessage(..., '*')` would plausibly classify that as credential
interception. It was not — the parser only ever looked for `video_versions`,
`image_versions2`, `carousel_media` and GraphQL `edges`, and never read headers
or cookies — but the *shape* of the code matched the pattern. That is now gone,
which is the substantive answer to the allegation rather than a denial of it.

---

## 14. Claim validation matrix

One row per claim the appeal or the store listing relies on. "Verified in
v4.3.10" means verified against **the source at annotated tag `v4.3.10`** — not
against the ZIP that was uploaded to the Chrome Web Store, which could not be
located (see §0). Line numbers are as of commit `1fc3544`.

| # | Claim | v4.3.10 tagged source | Remediated 4.4.1 | Evidence | Test | Limitation / caveat |
|---|---|---|---|---|---|---|
| 1 | **No credential collection** | **Yes** — none found | **Yes** | Static scans over all shipped files, §7 and §11. Only `password` occurrence is `url-allowlist.js:57`, which *rejects* credentialed URLs | `compliance.test.js` → "no shipped code reads cookies, tokens, passwords or auth headers"; "the URL allowlist rejects credentials embedded in a URL" | Static analysis only. Neither version was run under a network monitor by this audit; the manual plan (`MANUAL_CHROME_TEST_PLAN.md` §17) covers that gap for 4.4.1 only |
| 2 | **No password or 2FA form** | **Yes** — none found | **Yes** | No `<form>` and no `type="password"` in `popup.html`, `gallery.html`, `privacy-policy.html`. Only two inputs exist: `gallery.html:1304` (`search-input`), `gallery.html:1354` (`file-input`) | `compliance.test.js` → "there is no login form or password field in any page"; "the only inputs anywhere are the search box and the import file picker" | None |
| 3 | **No cookie or authentication-token access** | **Yes** — none found | **Yes** | No `document.cookie`, `chrome.cookies`, `csrftoken`, `sessionid`, `x-csrftoken`, `Authorization`, or bearer handling in any version. `cookies` and `webRequest` never requested | `compliance.test.js` → "no shipped code reads cookies, tokens, passwords or auth headers"; "manifest requests no credential-, tracking- or privilege-related permission" | None |
| 4 | **No credential transmission** | **Yes** — none found | **Yes** | Only ever one telemetry endpoint (Google Analytics), and its payload was event names + counts + a random client ID. Enumerated in §5 | `compliance.test.js` → "only documented external hosts appear in shipped source" | Inferred from reading `analytics.js:27–64` at the tag; no captured 4.3.10 network trace exists to prove what was actually sent on the wire |
| 5 | **No Google Analytics or external telemetry** | **No — GA was present** | **Yes** | 4.3.10: `analytics.js:6` (GA4 measurement ID, `G-PX8PH…`, redacted), `:7` (Measurement Protocol API secret, `XsR9…`, redacted), `:40` (POST to `google-analytics.com/mp/collect`), `manifest.json:20` (host permission). 4.4.1: file deleted, ~95 call sites removed, host permission removed | `compliance.test.js` → "no analytics file ships"; "no Analytics reference remains in shipped source"; "no Google Analytics endpoint or identifier remains"; "the specific GA credentials that shipped through 4.4.0 are gone"; "no beacon or websocket telemetry channel exists" | This is the one claim that is **false for 4.3.10 and 4.4.0**. Disclosed by name in `privacy-policy.html` §Change history and `CWS_PRIVACY_DISCLOSURES.md` §7 |
| 6 | **No remote code** | **Yes** | **Yes** | No remote `<script>`/`<link>`/`@import`, no `eval`, no `new Function`, no dynamic `import()`, no `importScripts`, no `scripting` permission, in any version. JSZip is bundled at `lib/jszip.min.js` | `compliance.test.js` → "no shipped code loads or evaluates remote script"; "manifest is V3 with no remote-code affordances" | `new Function` is *not* scanned inside `lib/jszip.min.js` — it is a vendored minified bundle (JSZip 3.10.1, MIT/GPLv3) reviewed only as a whole, not line by line. Stated explicitly in §8 |
| 7 | **Capture disabled by default** | **No — always on** | **Yes** | 4.3.10: `injector.js:141` replaced `window.fetch` and `:172` `XMLHttpRequest.prototype.open` unconditionally at `document_start`; `content.js:1194`/`:1260` did it a *second* time. 4.4.1: `capture-hook.js:230` (`active = false`), `:252` `install()` runs only on a control message; `content.js:112` (`captureActive = false`), `:246` gate | `capture-gate.test.js` → "content.js: capture is inactive on load"; "capture-hook.js: nothing is patched on load"; "content.js: merely loading on instagram.com writes nothing to storage"; "SBE_MEDIA is discarded while capture is inactive" | Not persisted by design, so it is off again after any reload. Browser confirmation still outstanding — `MANUAL_CHROME_TEST_PLAN.md` §3–4 |
| 8 | **Explicit user action required** | **No** | **Yes** | `popup.js:293` `CONSENT_KEY`, `:298` `showConsent()`, `:336` `beginCapture()`; `content.js:429–436` `withConsent()` re-reads the stored flag, so a forged `START_CAPTURE` cannot bypass the disclosure | `capture-gate.test.js` → "withConsent reports false when no consent is stored"; "withConsent reports true only for a positive numeric stamp" | The popup UI is a disclosure surface; the enforcement point is `content.js`. Both are required to pass |
| 9 | **Stop restores interception** | **Not applicable** — nothing was ever uninstalled in 4.3.10 | **Yes** | `capture-hook.js:297` `uninstall()`, `:302` restores `window.fetch` **only if it is still our wrapper**; `content.js:553` `stopCapture()` drops the gate first, then signals uninstall | `capture-gate.test.js` → "start wraps fetch and XHR, stop restores them"; "stop leaves a third party's later wrapper alone"; "start is idempotent"; "media arriving after Stop is discarded" | Verified in a stubbed sandbox, not a real page. `MANUAL_CHROME_TEST_PLAN.md` §10–11 |
| 10 | **Strict message and URL validation** | **No** | **Yes, with one gap — see OF-1** | 4.3.10: `injector.js:158`/`:189` posted to `'*'`; `content.js:98–100` checked only `event.source` and `data.type`. 4.4.1: `content.js:137` origin allowlist, `:142` `LIMITS`, `:214` `validateMediaMessage()`, `:291` `atRecordLimit()`; `url-allowlist.js:27/33/40/55/57`; import path `gallery.js:972/991/1039` | `message-validation.test.js` (23 tests) — 20 hostile URLs rejected, 13 malformed envelopes, 11 malformed items, depth/cycle/result caps, import sanitisation | Two caveats. (a) The MAIN-world copy of the allowlist is page-tamperable by design; the authoritative check is the isolated-world one (§4). (b) **The allowlist is not applied at render time** — see open finding **OF-1**, §15. Records stored by 4.4.0 or earlier were never validated and are not re-validated on upgrade |
| 11 | **Single purpose** | **No** | **Yes** | 4.3.10 `manifest.json` content_scripts included `autoplay.js` (586 lines, unrelated video autoplay). 4.4.1: deleted, along with its popup toggle, its tests, and its stored prefs | `compliance.test.js` → "no analytics file ships" (asserts `autoplay.js` absent); `build.test.js` → "zip does NOT include developer artifacts" | The gallery's slideshow is retained: it views the user's *own captured library*, which is the same purpose, not page autoplay |
| 12 | **Neutral branding** | **No** | **Yes** | 4.3.10: name `Instagram Saved Media Exporter`; `create-icons.html` drew Instagram's gradient + camera lens + flash dot; icons were a photo of the developer on pink-magenta; `instagram-*` download filenames. 4.4.1: renamed, `tools/make-icons.py` generates neutral teal/slate, 38 brand hex/rgba occurrences replaced, album glyph replaced, filenames `saved-posts-*` | `compliance.test.js` → "the extension name and description do not claim affiliation"; "no Instagram brand colour survives in the shipped UI"; "the required non-affiliation disclaimer appears in the popup, gallery and policy"; "user-facing download filenames are not Instagram-branded" | Store screenshots and the **deployed** landing page are still non-compliant — they are outside the package. See §13 items 6, 6a and `LANDING_PAGE_DEPLOYMENT_CHECKLIST.md` |
| 13 | **Accurate privacy disclosures** | **No — materially inaccurate** | **Yes** | 4.3.10 `privacy-policy.html:45` claimed no data transmitted, `:73` claimed no analytics (both false), `:58` claimed only media URLs were stored (understated 9 further categories), `:66`/`:67` listed `tabs`/`scripting` which the manifest never requested. 4.4.1: rewritten, with a change-history section naming the discrepancy | `compliance.test.js` → "the privacy policy is inert static HTML"; disclaimer assertion. The data-category table itself is prose and is **not** machine-checked | The policy's accuracy is asserted by this audit, not by a test. A reviewer should read §9 against the policy's category table directly. The policy's XSS-safety implication is qualified by **OF-1** (§15) |
| 14 | **Minimum permissions** | **No** | **Yes** | 4.3.10: `storage`, `unlimitedStorage`, `activeTab` + 3 hosts incl. `google-analytics.com`. 4.4.1: `manifest.json:12` `storage`, `unlimitedStorage`; `:16` two instagram.com hosts only | `compliance.test.js` → "manifest requests only the two documented permissions"; "host permissions are limited to instagram.com, with no wildcard scope"; "content scripts match only instagram.com" | `activeTab` removal is **not browser-verified** — `MANUAL_CHROME_TEST_PLAN.md` §12. `unlimitedStorage` is defensible but droppable; §3 and §13 item 7 |
| 15 | **Local deletion control** | **Partial** — cleared data but not consent (no consent existed) | **Yes** | `popup.js:386` Clear all data → wipes `igExporterData` and `:396` removes `CONSENT_KEY`, so the disclosure is shown again; gallery has an equivalent control | `capture-gate.test.js` → "CLEAR-shaped storage change wipes in-memory state" (asserts images, videos **and** the dedup set reset) | Deletion is local only, which is complete here because nothing is ever uploaded |

### Summary

Of the 15 claims, **8 were already true in the 4.3.10 tagged source** (1, 2, 3,
4, 6, and partially 15), and **7 were false or absent** and are the substance of
this remediation (5, 7, 8, 9, 10, 11, 12, 13, 14 — claim 9 being not applicable
rather than false).

The three claims a reviewer should probe hardest, because they rest on
something other than a passing test:

- **Claim 13 (accurate disclosures)** — prose, asserted by audit, not by a test.
- **Claim 4 (no credential transmission)** for 4.3.10 — inferred from reading
  the source at the tag; no network capture of the published build exists.
- **Claims 7, 9, 14** — verified in a stubbed sandbox; the browser checks in
  `MANUAL_CHROME_TEST_PLAN.md` are still unrun.

---

## 15. Open findings from the review-bundle pass

Discovered on 25 August 2026 while assembling the independent review bundle,
**after** the 4.4.1 remediation commit `1fc3544`. Recorded here rather than
fixed, because the review request explicitly forbade further product changes.
Neither is fixed in the packaged artifact.

### OF-1 — Unescaped values reach an HTML sink in `showVideoFallback()`

| | |
|---|---|
| Location | `gallery.js:641–656`, sink at `gallery.js:651` |
| Severity | **Low–Moderate.** Not reachable from live Instagram content in 4.4.1; reachable only from pre-existing or hand-crafted storage. |
| Status | **OPEN — not fixed** |
| Detected by | `tests/compliance.test.js` → *"every HTML sink in shipped code is escaped, static, or internal"* (currently **FAILING**), and `static-compliance-scan.txt` Part 1c |

`showVideoFallback(linkUrl, thumbnailUrl)` interpolates both arguments into HTML
attributes without escaping and without an allowlist check at render time:

```js
let thumbHtml = thumbnailUrl ?
  '<img src="' + thumbnailUrl + '" style="…">' : '<div …>🎬</div>';

viewerPlaceholder.innerHTML = '<div …>' +
  thumbHtml +
  '<p …>Direct video URL not available</p>' +
  (linkUrl ? '<a href="' + linkUrl + '" target="_blank" class="btn-link">▶ Open on Instagram</a>' : '') +
  '</div>';
```

**Why the allowlist does not cover this.** `SBE_URL` is applied at four points —
capture (`content.js:214`), import (`gallery.js:993–1001`), ZIP fetch
(`gallery.js:1313`, `:1378`) and single download (`gallery.js:1502`) — but **not
at render time**. `showVideoFallback` is reached from `showVideo()`
(`gallery.js:634`) whenever a video record has no playable CDN URL, and it reads
`item.postUrl` / `item.thumbnail` straight out of storage.

**Exploitability.** Requires a hostile value to already be in
`chrome.storage.local`. Three ways that can be true:

1. The user imported a crafted JSON file under **4.4.0 or earlier**, when Import
   performed no validation at all, and then upgraded. 4.4.1 sanitises *new*
   imports but never re-validates records already stored.
2. Capture under 4.4.0 or earlier, which also applied no URL allowlist.
3. Direct manipulation of extension storage, which needs devtools access.

It is **not** reachable by anything Instagram serves to a 4.4.1 user, because
capture-path records are validated on the way in. So this does not re-open the
phishing question, and it is not remotely triggerable — but it does mean the
"escape before `innerHTML`" invariant is **not** currently universal, and the
claim in §14 row 10 needs the caveat recorded there.

**Proposed fix** (deliberately not applied — one line plus one guard):

```js
function showVideoFallback(linkUrl, thumbnailUrl) {
  var api = globalThis.SBE_URL;
  var safeThumb = (api && api.isAllowedMediaUrl(thumbnailUrl)) ? thumbnailUrl : null;
  var safeLink  = (api && api.isAllowedPostUrl(linkUrl))       ? linkUrl       : null;
  // …then interpolate only safeThumb / safeLink, via escapeHtml() for the
  // attribute values.
}
```

A stronger variant also re-validates every record in `loadFromStorage()` on
first read after upgrade, which closes route 1 and 2 for existing users rather
than only at the render site. That is the change I would recommend, and it
should carry its own test.

### OF-2 — The previous escaping test was blind to multi-line statements

| | |
|---|---|
| Location | `tests/compliance.test.js` (the pre-review version of the sink test) |
| Severity | **Moderate — it was producing a false assurance** |
| Status | **FIXED** in the test (evidence tooling, not product code) |

The earlier test examined only the first line of each `.innerHTML =`
assignment. Because `gallery.js:651` begins with a string literal and continues
on the following lines, it was classified as a "static literal" and passed —
while the unescaped interpolation three lines down went unexamined. It also did
not consider `.outerHTML` at all.

That is worth stating plainly: **the test asserting the escaping claim was
passing for the wrong reason.** It has been rewritten to join continuation lines
and to cover both sinks, which is what surfaced OF-1. The rewritten test now
fails honestly rather than passing blindly.

Consequence for anything already written: statements elsewhere in this document
and in `CWS_STORE_LISTING.md` that rest on "every `innerHTML` assignment is
escaped or static" were true of every site **except** `gallery.js:651`. §14
row 10 and row 13 carry the correction.

### Effect on the test suite

`npm test` now reports **322 passing, 1 failing**. The single failure is OF-1,
detected on purpose. It is not a regression introduced by the remediation — the
code at `gallery.js:651` predates 4.4.1 and is unchanged by it; what changed is
that the test can finally see it.

**The review bundle is therefore NOT a clean pass, and is not described as one.**

### OF-3 — Marketing screenshots contain identifiable third-party personal data

| | |
|---|---|
| Location | `assets/screenshots/screenshot-{1,2,3,4}-*.png` (unchanged since 4.3.10) |
| Severity | **Moderate — a privacy problem in its own right, separate from branding** |
| Status | **OPEN.** Excluded from the review bundle; still present in the repository and still the live store/landing-page assets. |

§13 item 6 already flagged these for recapture because they show Instagram's UI
in the old pink/purple design. Assembling the review bundle surfaced a stronger
reason: they contain **real captured data about third parties**.

`screenshot-2-gallery.png` alone shows at least three identifiable Instagram
usernames (`@d****e`, `@e***a.j***e.m***l`, `@l**a.b***e.bb`), photographs of
identifiable people, and real post captions — published as Chrome Web Store
marketing material. None of those people consented to appearing in the store
listing for a third-party extension.

`assets/icons/maker.png` is a photograph of the developer. Not a third-party
issue, but personal data that was shipped inside the extension package through
4.4.0 and served no functional purpose.

**Handled in the bundle:** both were removed from `remediated-source-4.4.1.zip`
and `v4.3.10-tagged-source.zip`, with the exclusion documented in-place
(`PRIVACY-EXCLUSIONS.txt` and `READ-THIS-FIRST.txt`) and in `secret-scan.txt`.
Neither is code; neither is needed to build or test; `build.sh` has never
packaged `assets/screenshots/`.

**Still to do, by a human:**

1. Recapture every store screenshot against a **test account with the
   uploader's own content**, in the new neutral UI.
2. Do the same for `assets/og-image.png`, which the landing page references from
   `raw.githubusercontent.com` and which this audit never inspected.
3. Consider whether the existing files should stay in git history at all. They
   are public in a public repository.

This does not affect the extension package — but it is exactly the kind of thing
a privacy reviewer would find, and it is better disclosed than discovered.

---

## 16. Version 4.4.2 — what the independent review found, and what changed

An independent review reproduced the 4.4.1 bundle's hashes and its test result
(323 tests, 322 pass, 1 fail) and **did not approve 4.4.1 for submission.** It
found that open finding OF-1 was scoped too narrowly.

### 16.1 The finding, correctly scoped

OF-1 was written up as "unescaped values reach an HTML sink at
`gallery.js:651`". That was one symptom. The actual defect:

> Records already present in `chrome.storage.local` from versions ≤ 4.4.0 were
> loaded **without sanitisation**. 4.4.1 validated data on the way *into*
> storage (capture, import) but not on the way *out of* it.

Because the gallery reads those records directly, a hostile legacy URL could
reach **every** URL sink it has, not just one `innerHTML`:

| Sink | Reached via |
|---|---|
| `viewerPlaceholder.innerHTML` | `showVideoFallback()` string concatenation |
| `img.src` (grid) | `renderGrid()` thumbnails |
| `img.src` (carousel strip) | `buildCarouselStrip()` |
| `video.src` / `player.src` | `showVideo()` |
| `imageViewer.src` | `showImage()` |
| `fullscreenImage.src` | fullscreen viewer |
| `fullscreenVideo.src` | fullscreen viewer |
| `window.open` | video download path |
| `fetch` | single download, album ZIP, library ZIP |
| clipboard | Copy URLs |
| JSON export | `buildExportPayload` |
| CSV export | `buildCsv` |

Fixing one statement would have left eleven.

### 16.2 The two-part fix

**Part 1 — sanitise where data enters the process.** New
`library-sanitize.js` (`globalThis.SBE_LIB`) is the single authoritative path.
It rebuilds every record field by field and is applied at:

| Entry point | Location |
|---|---|
| Initial storage load | `gallery.js` `loadData()` → `adoptLibrary(..., {persist:true, report:true})` |
| `chrome.storage.onChanged` | `gallery.js` listener → `adoptLibrary(..., {persist:true})` |
| Imported JSON | `gallery.js` file-input handler → `adoptLibrary()` |
| Imported legacy URL list | same handler → `adoptLibrary()` |
| Clear-all | `adoptLibrary(null, {})` |
| Content-script load | `content.js` `loadFromStorage()` → `SBE_LIB.sanitizeLibrary()`, then persists |

`adoptLibrary()` is now the **only** thing permitted to assign `allMedia.images`
or `allMedia.videos`; the previous eight direct assignment sites are gone.

Properties: unknown keys are never copied; media URLs go through
`SBE_URL.isAllowedMediaUrl`, post URLs through `isAllowedPostUrl`;
`javascript:`, `data:`, `blob:`, `file:`, `chrome-extension:`, `http:`,
localhost, IP literals and third-party hosts are all rejected; list sizes and
string lengths are capped; usernames, shortcodes, timestamps, counts, carousel
indexes and hashtags are pattern-validated. A **valid post-only video record is
preserved** (allowlisted `postUrl`, no playable media URL) — an expired CDN link
must not cost the user the record. An invalid *optional* field is nulled, not
fatal. Invalid thumbnails are nulled rather than rendered. The cleaned library
is written back to storage so unsafe values are removed permanently, and the
count of removed records and fields is reported to the user.

**Feedback-loop avoidance:** the rewrite fires only when sanitisation actually
changed something, so the second pass over clean data writes nothing and the
`onChanged` cycle terminates. A `_suppressStorageEcho` flag additionally ignores
the extension's own write. Both are tested.

**Part 2 — validate again at every sink.** `safeMediaUrl`, `safePostUrl`,
`safeExternalNavigationUrl` and `safeExportUrl` in `gallery.js`, applied inline
at each sink rather than via an earlier local variable, so the guard is visible
at the point of use. `getUrl` / `getThumbnail` / `getPostUrl` / `getMediaUrl` are
themselves guarded, closing most of the class at the accessor.

`showVideoFallback()` is rebuilt with `createElement` / `textContent` /
`replaceChildren` — no HTML string, so no attribute to escape from. It shows an
image only for an allowlisted media URL, offers "Open original post" only for an
allowlisted permalink, **never uses a raw media URL as that link**, and falls
back to static text with no external navigation when neither exists.

### 16.3 Two further defects found while fixing this

Both were found by the new tests, not by inspection:

1. **A URL containing markup was accepted.**
   `https://scontent.cdninstagram.com/<script>alert(1)</script>.jpg` has a
   legitimate host, so the allowlist passed it. `new URL()` percent-encodes the
   angle brackets, so inspecting the *parsed* result would not have revealed it —
   but the **raw string** was what got stored, copied and exported.
   `url-allowlist.js` now rejects any URL whose raw string contains
   `< > " ' \` \\`.

2. **A permalink was accepted as media.** `isAllowedMediaUrl` included the
   instagram.com hosts, so `https://www.instagram.com/p/X/` could be assigned to
   `player.src` — a type confusion between "media asset" and "web page".
   `isAllowedMediaUrl` is now **CDN-only**; media and pages are separate
   namespaces, enforced by test.

### 16.4 Content Security Policy (new)

```
script-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none';
frame-ancestors 'none'; form-action 'none';
connect-src 'self' https://*.cdninstagram.com https://*.fbcdn.net;
img-src 'self' data: https://*.cdninstagram.com https://*.fbcdn.net;
media-src 'self' blob: https://*.cdninstagram.com https://*.fbcdn.net
```

No `unsafe-inline`, no `unsafe-eval`, no `wasm-unsafe-eval`, no remote script
source, no bare scheme, no wildcard beyond the two CDN subdomain wildcards.
`data:` is required by the static broken-thumbnail placeholder; `blob:` by local
playback of a fetched video. `style-src` is deliberately **not** declared: the
pages use inline `<style>` blocks and `style=` attributes, and declaring it
would force `'unsafe-inline'` — leaving it unset restricts nothing but adds no
unsafe keyword either. 14 assertions in `tests/csp.test.js`.

**Limitation, stated plainly: the CSP has never been loaded into Chrome.**
`tests/csp.test.js` validates its syntax, directives and hosts statically. It
cannot tell you whether Chrome accepts every directive, nor whether CDN
thumbnails and ZIP downloads still work under it. Those are manual blockers —
`MANUAL_CHROME_TEST_PLAN.md` §20 and §21, which instruct the tester to record
the exact Chrome error text if a directive is rejected.

### 16.5 Test suite

**368 tests, 368 passing, 0 failing.** The 4.4.1 bundle shipped with a
deliberate failure; that is no longer acceptable and no longer present.

| Suite | Tests | Adds |
|---|---|---|
| `legacy-storage.test.js` | 17 | Hostile records seeded into the **storage stub**, not an import file: 24 hostile URLs dropped; hostile thumbnail nulled without losing the record; post-only record preserved; media/permalink namespaces kept separate; `innerHTML`/`outerHTML`/`onclick`/`srcdoc`/`style` properties not copied; malformed entries and array shapes survived; metadata validated; list capped; persistence on change; **no rewrite when already clean**; idempotence; fail-closed without the sanitiser; removal counts reported; `content.js` sanitises and re-persists |
| `url-sinks.test.js` | 14 | **Enumerates** every `.src` / `.href` / `.poster` / `window.open` / `fetch` / clipboard / `setAttribute` sink across six source files and requires each to be guarded or listed as documented-static with a reason; asserts no stale exemptions; guards fail closed on 8 wrong-typed inputs; media≠permalink; `isPlayableVideoUrl` allowlists before pattern-matching; CSV and JSON exports carry no hostile URL; `showVideoFallback` contains no HTML string |
| `csp.test.js` | 14 | Policy present; `script-src 'self'` exactly; no unsafe keyword; object/frame/base/form locked; connect/img/media limited to self + the two CDNs; no host beyond them; no broad wildcard (token-wise); no `http:`; MV3 object form; CSP hosts and allowlist hosts in lockstep |

A new unguarded sink fails `url-sinks.test.js` **by default** — the test does not
need updating to catch the next one.

### 16.6 Corrected claims

`CWS_STORE_LISTING.md` §"Corrections in 4.4.2" and
`CWS_PRIVACY_DISCLOSURES.md` §3a and §5a carry the detail. Summary of what was
wrong and is now fixed:

| Was claimed | Reality |
|---|---|
| Collection survives a deleted post | Capture stores a URL. A deleted post stops resolving; nothing is recoverable. |
| Everything works offline once captured | Library metadata works offline; media is fetched from the CDN when displayed or downloaded. |
| Capture creates a complete local media backup | Capture creates links + metadata. Files exist only after an explicit download. |
| Never handles another person's private post | A post saved from a private account the user follows *is* processed — legitimately. Correct claim: it never accesses content the signed-in user is not authorized to view. |
| Downloads only "your own media" | The media belongs to whoever posted it. |
| Only two permission categories | Two API permissions **and** host access — three things. |
| PII: No | **Yes.** Usernames are account identifiers. Used only locally for grouping and search; never transmitted. |
| "Nothing is transmitted" (absolute) | Replaced everywhere: the captured library is not transmitted to the developer, analytics, advertising or unrelated third parties; displaying or downloading media does cause the browser to request the allowlisted CDN URL. |

`privacy-policy.html` additionally now discloses that opening the library can
load thumbnails from the CDN, replaces "Downloading your own media" with
"Displaying or downloading media from posts you saved", and lists `storage`,
`unlimitedStorage` and host access separately.

### 16.7 Landing page and screenshots

`index.html` (source only — **not deployed**): Formspree form and both links
removed in favour of GitHub Issues; testimonial CSS and the explanatory comment
removed; the unsupported claims ~~hundreds of posts in minutes~~,
~~less than 5 seconds~~ and ~~no data is ever sent to external servers~~
removed; "Get It Free on GitHub" → "View Source
on GitHub"; stale `og:image` tag removed (the file it referenced never existed);
capture-vs-download distinction stated. Disclaimer retained.

`SCREENSHOT_PLAN.md` is new and required reading before any listing image is
made. The existing `assets/screenshots/*.png` remain disqualified — they contain
real third-party usernames and identifiable people (OF-3), and now also show a
superseded UI.

### 16.8 Still open

- **OF-3** (real third-party data in the old marketing screenshots) — unchanged.
  Excluded from every bundle; must be recaptured per `SCREENSHOT_PLAN.md`.
- **The deployed landing page** still serves the old content until republished.
- **The GA4 API secret** remains in public git history and should be revoked in
  the Google Analytics console.
- **All ten manual browser blockers** in `MANUAL_CHROME_TEST_PLAN.md`, three of
  which (CSP acceptance, CSP-permitted CDN loads, hostile-legacy-storage
  removal) have never been exercised in a browser at all.

---

## 17. Version 4.4.3 — why 4.4.2 was rejected, and what changed

4.4.2's hashes verified and 368/368 tests passed independently. It was still
**not approved**, because an independent review found four defects that the test
suite could not see. That is the lesson worth recording: a green suite is
evidence about what is tested, not about what is true.

### 17.1 JSON import threw a ReferenceError and never persisted

`gallery.js`, in the file-input handler, built its status message from
`imgs.items.length` and `vids.items.length` — two variables that had been
deleted when the handler was rewritten to use `adoptLibrary()`. The throw landed
**after** `adoptLibrary()` and **before** `chrome.storage.local.set()`, so a JSON
import updated the library in memory, rendered nothing, and silently persisted
nothing. Reloading the gallery lost everything.

**How it escaped 368 tests.** `parseImportPayload()` was covered.
`sanitizeImportedList()` was covered. Nothing executed the code that *joins*
them. Unit coverage of both ends of a seam proves nothing about the seam.

**Fix.** The flow is extracted into three testable functions —
`applyParsedImport()`, `persistCurrentLibrary()`, `runImport()` — and
`tests/import-flow.test.js` (14 tests) drives the real path end to end: no
exception, library updated, `chrome.storage.local.set()` actually called with
the sanitised data, counts and grid re-rendered, file input reset, correct
accepted/rejected counts, and no hostile URL reaching storage. `runImport()`
also wraps the apply step so an unexpected throw reports to the user instead of
skipping the persist and render steps.

**Verified to catch the regression.** With the defect deliberately reintroduced
in a scratch copy, `tests/import-flow.test.js` fails 6 of 14 — while the
pre-existing `tests/export-import.test.js` still passes 15/15. That contrast is
the evidence that the new tests cover something the old ones did not.

### 17.2 Change detection missed most transformations

`sanitizeLibrary()` derived `changed` from record-count differences and the
rejection tally alone. A record could be **rebuilt differently with zero
rejections** — an unknown `innerHTML` / `onclick` / `srcdoc` / `style` property
dropped by not being copied, an invalid `type` normalised, a negative
`carouselSize` clamped, an over-long caption truncated, extra metadata keys
discarded. In all those cases the in-memory object was safe, `changed` was
false, `persist` never fired, and **storage still held the unsafe original** —
directly contradicting the claim that unsafe legacy values are permanently
removed.

**Fix.** `changed` now compares a canonical serialisation of the input against
the output (`canonicalRecord` / `canonicalList`). Keys are emitted in a **fixed
order**, so the comparison never reports a difference merely because two objects
enumerate their properties differently — an order-sensitive check would rewrite
storage on every single load, forever. Unknown top-level keys and unknown
metadata keys are both detected, which is what catches the dropped-property
case.

Idempotence, and therefore the absence of a feedback loop, follows from
`sanitizeRecord` being a fixed point: sanitising sanitised output reproduces it
exactly, the canonical forms match, and `changed` is false. Asserted directly.

`tests/legacy-storage.test.js` grew to 33 tests covering ten transformation
classes, persistence of a rebuilt record with zero rejections, persistence of
truncation and normalisation, the fixed-point property, key-order insensitivity,
no write for a canonical clean library, and the same guarantees in
`content.js#loadFromStorage`.

### 17.3 The reproducible-build claim was false across directories

4.4.2 claimed reproducibility on the strength of three builds **in the same
working directory**. That is not evidence of anything. A reviewer building the
shipped snapshot in their own directory got
`99ce31f507a7af5b0e1ae2059a2d3f6d8e807bb9b57d95ed82364e1a95c6147b` instead of
`05443bdae745bc1960097ead3afb8be1f7f5cb44ffdaa045039ce0ee553e7fea`, with
`diff -qr` finding zero differences in the extracted contents.

**Cause.** `zip -r ./*` walks directories in **filesystem order**. `LC_ALL=C`
sorts the top-level shell glob but does nothing about the recursive descent into
`assets/icons/` and `lib/`. The 4.4.2 artifact's entry order was
`icon-16, icon-48, icon-128, icon-32` — visibly unsorted, i.e. traversal order.

**Fix.** `build.sh` now generates an explicitly `LC_ALL=C sort`ed list of files
(`find . -type f`, no directory entries) and passes it to `zip -X -q -@`. Entry
order is now a function of the sort, not of the filesystem.

**Honest note on reproduction.** On this machine's APFS the two directory
layouts happened to return the same traversal order, so the *divergence* did not
reproduce locally — only the *cause* did, visible as the unsorted entry list.
`tests/reproducible-build.test.js` therefore asserts the property rather than
relying on a coincidence: two clean directories populated in opposite insertion
orders must yield identical hashes, the extracted trees must be byte-identical,
the entry list must be byte-sorted with no directory entries, a clean build must
match the repository artifact, and `build.sh` must not contain `zip -r`.

### 17.4 The privacy disclosures were wrong in five ways

| Claim | Reality | Fixed |
|---|---|---|
| `User activity: No` | The popup incremented `useCount` on **every open** and used it to trigger a donation banner on the 15th. That is user-activity tracking however local it is. | **Feature removed entirely** — counter, threshold, banner, and `supportDismissed`. `legacy-cleanup.js` deletes both keys from existing installs. A static support link that stores nothing remains. The answer is still **Yes**, because `sbeConsentAcceptedAt` and `igExporterLastSeenAt` remain and are load-bearing (§17.5). |
| ~~never touches the clipboard~~ | Copy URLs writes to it. | "never **reads** your clipboard; writes selected URLs only after an explicit Copy." |
| ~~never touches downloads~~ | It creates the downloads the user asks for. | "does not request the `downloads` permission and cannot read download history; it does create user-requested downloads." |
| ~~No data leaves your device~~ | The browser fetches media from Meta CDN hosts. | Replaced with the scoped non-transmission sentence, plus an explicit two-tier network model. |
| CDN requests happen ~~only when you press Download~~ | Opening the library renders thumbnails, which fetches from the CDN before any download. | Two tiers documented identically in the policy, the listing, the disclosures and the manual plan: **automatic** on render, **explicit** on download. |

A phantom stored "sort order" was also removed from the privacy inventory —
nothing persists it.

`tests/disclosure-consistency.test.js` (23 tests) now asserts all of this
mechanically: the storage-key inventory matches what the code writes, no
document denies user activity, no absolute "leaves your device" claim survives,
no "only on Download" claim survives, the clipboard read/write distinction is
stated, the product name agrees across manifest/UI/docs, this document's Final
package section names the current artifact, and the stated test count is at
least the number of tests declared on disk. Retracted claims are marked
`~~struck~~` so a corrections table can quote old wording without the scanner
reading it as an assertion.

### 17.5 Storage-key inventory (current, authoritative)

| Key | Written by | Purpose | Transmitted |
|---|---|---|---|
| `igExporterData` | `content.js`, `gallery.js`, `popup.js` | the captured library | No |
| `igExporterLastSeenAt` | `popup.js`, `gallery.js`, `background.js` | "new since you last looked" badge | No |
| `sbeConsentAcceptedAt` | `popup.js` | **enforces** the consent gate; `content.js` refuses to start without it | No |
| `sbeLegacyCleanupAt` | `legacy-cleanup.js` | audit marker: legacy telemetry sweep completed | No |
| `sbeLibrarySanitizedAt` | `gallery.js` | audit marker: library sanitisation pass | No |

Deleted in 4.4.3 and actively removed from existing installs: `useCount`,
`supportDismissed`, `igAutoplayEnabled`, `igAutoplayMuted`. Nothing is written
to `localStorage` or `sessionStorage`.

### 17.6 The icon: the developer's portrait, restored

**The icon is a photograph of the independent developer, and that is
deliberate.** It is an established part of his personal brand, and a recognisable
human face is one of the clearest possible signals that this is not an official
Instagram or Meta product.

The trade-dress problem in the removed version was never the face — it was the
**Instagram-like pink/magenta/purple gradient** behind it. 4.4.1 and 4.4.2
over-corrected by replacing the portrait with a generic archive glyph, which the
developer did not approve. 4.4.3 restores the portrait and keeps the gradient
gone.

The icon contains **no Instagram or Meta logo, camera glyph, album glyph,
wordmark, notification badge, verification tick, trade dress, or official
branding of any kind.** The previous pink/magenta background has been replaced
with a flat neutral slate plate (`#131A22`) and a teal ring (`#0F8B8D`), the same
accent the remediated UI uses.

| | |
|---|---|
| Source | `assets/icons/portrait-source.png` — 280×280, the developer's own photograph, restored from `v4.3.10:assets/icons/maker.png` |
| Ownership | The photograph is the developer's own. No third-party face and no stock or copyrighted photograph is used. |
| Treatment | Cropped to 136×136 around the face and composited unmodified. **No** brightness, contrast, colour, cartoonisation or retouching is applied — see `tools/make-icons.py`. |
| Generated sizes | 16, 32, 48, 128 (all downscales) + a 256px design master that never ships |
| **Resolution limitation** | The best developer-owned portrait in the repository is **280×280**. All four shipped sizes are downscales, so this is sufficient for them; the 256px master is a mild upscale and is a build input only. If a higher-resolution original becomes available, replace `portrait-source.png` and rerun the generator — no other change is needed. |
| Not shipped | `portrait-source.png` and `icon-source.png` are build inputs. `build.sh` copies exactly the four referenced sizes. |
| Consistency | The same portrait identity is used in the extension, the landing page nav, and is required of future synthetic store screenshots (`SCREENSHOT_PLAN.md`). |

**Branding tests were updated, not weakened.** `tests/icon-branding.test.js`
(10 tests) still rejects Instagram brand colours and glyphs, but scopes the
colour assertions to the **plate and ring** — sampling the four corners and
scanning the top 12% of each icon for magenta/orange pixels. The circular
portrait region is deliberately exempt, because a photograph legitimately
contains varied pixels including warm skin tones, and failing an authorised
portrait for that reason would be a false positive. The tests additionally
require that the generator composites the real photograph (no `polygon`, `arc`,
`text`, `ImageFont`), does not retouch it (no `ImageEnhance`, `ImageFilter`,
greyscale conversion), declares no warm colour constant, references no Instagram
glyph in code, produces >400 distinct colours in the portrait region (so a
future swap back to a flat glyph fails loudly), and regenerates byte-identically.

**Previews of all four sizes are included in this review bundle**
(`icon-previews/`) so the developer can approve them before publication.
**Passing automated tests is not approval.**

### 17.7 Landing page (source only — not deployed)

Removed: the fake `Add to Chrome — Free` CTA and its inline
`alert('Coming soon…')`; `Saved Posts Backup`; `Back Up Your Saved Posts`;
"download all"; "Never lose your favorite content again"; "Automatically
captures all slides"; "No content left behind"; "No more screenshots or manual
downloads"; and the `<img>` pointing at the disqualified
`screenshot-2-gallery.png` marketing capture.

Added: the accurate product name, the capture-vs-download distinction with an
explicit statement that media links can expire, a truthful "View source on
GitHub" link plus a note that the extension is not currently listed, a
carousel description that says yield is not guaranteed and that opening a post
is what makes remaining slides available, and a neutral dashed placeholder where
the screenshot was. The non-affiliation disclaimer is retained.

`tests/disclosure-consistency.test.js` asserts every one of those absences, and
that `index.html` references no `assets/screenshots/` path at all.

### 17.8 Still open after 4.4.3

- ~~**All twelve manual Chrome blockers**~~ — **CLOSED 2026-08-26** on a
  developer-performed, developer-reported run of `MANUAL_CHROME_TEST_PLAN.md`.
  All ⚠ BLOCKERs reported passing, including §23 (import round trip) and §24
  (malicious import), which existed precisely because the JSON import bug was
  only reachable by running it. See §19.
- ~~**OF-3**~~ — **CLOSED 2026-08-26.** The disqualified screenshots and
  `compose_screenshots.py` were deleted from the repository, and six compliant
  synthetic screenshots were generated. See §19.2 and §19.3. They remain in git
  history, and the developer's own untracked raw captures remain on disk.
- **The deployed landing page** still serves the old content until republished.
  `index.html` in the repository is remediated; **publishing it is a remaining
  human action** — see §19.6.
- **The GA4 API secret** remains in public git history and **is not revoked**.
  See §19.5, which states the exact remaining action and why this task could not
  perform it.
- **OF-4 (new)** — the Donate button uses an amber→teal gradient, which is not
  an Instagram brand colour but does contradict the "no warm hues" wording used
  elsewhere. Low severity, deliberately not fixed in 4.4.3 to preserve the
  approved ZIP hash. See §19.4.
- ~~**Icon approval**~~ — **CLOSED.** Explicitly approved by the developer's
  reviewer; the four PNGs are frozen. See §18.1.
- **Portrait resolution** — 280×280 is the best available; noted above. Not a
  blocker, and not worth regenerating an approved icon over.

---

## 18. Revision r2 — icon approval recorded, and a cross-environment test defect

Test/tooling only. **No extension source changed**, and the packaged artifact is
byte-identical to r1: `saved-posts-library-export-4.4.3.zip` is still
`91373ce6d3ce81e32d8d231de33105119dd416ef63b363bb972e358dcb975a90`.

### 18.1 The icon is explicitly APPROVED

The developer's reviewer has explicitly approved the v4.4.3 icon design. The
portrait, crop, colours, ring, background and the four shipped PNG files are
**frozen** and were not touched in r2:

| File | SHA-256 |
|---|---|
| `assets/icons/icon-16.png` | `104a81f2ef956d115682e5c2a1bbb2a5cedd6d7ca63e790c7794f15b35615ef4` |
| `assets/icons/icon-32.png` | `f6e31c6dc30d4165e841d8e77ec71cac62861d4a73e2f9beb8818a37e56fd813` |
| `assets/icons/icon-48.png` | `d5f9d74a31a04c13b90bb8fc6de52b59739b1fcaf99276703c82857f615acb46` |
| `assets/icons/icon-128.png` | `5dcbb236ad843fa77427c197da7df8cd8dee833558a1aa73bae26982d06add9d` |

These are the same bytes reviewed in the r1 bundle's `icon-previews/`. The icon
depicts the independent developer and is part of his personal brand; it contains
no Instagram or Meta logo, camera glyph, album glyph, wordmark, trade dress,
notification badge or verification tick. The previous Instagram-like
pink/magenta background was removed and replaced with a neutral teal/slate
treatment. §17.6 has the full rationale.

The former "awaiting developer approval" item is closed.

### 18.2 The defect: a test compared encoded PNG bytes across environments

An independent run on **Python 3.12.13 / Pillow 12.3.0** reported 437/438 with
one failure:

```
tests/icon-branding.test.js
  the icon files are reproducible from the generator
  icon-128.png changed when regenerated

original    icon-128.png: 5dcbb236ad843fa77427c197da7df8cd8dee833558a1aa73bae26982d06add9d
regenerated icon-128.png: a1360d4770863e1fcc2ff8604470432ffd95a4e8463f380da779bcc0be2096ca
same_pixels: true
```

The finding is correct and the test was wrong, in two independent ways:

1. **It compared encoded PNG file bytes.** PNG encoding is not stable across
   library versions: the encoder chooses row filters and deflate parameters, and
   those choices change between Pillow releases and between zlib builds. The
   reported `same_pixels: true` is the whole point — nothing about the artwork
   changed.
2. **It regenerated the icons in place**, overwriting the approved files as a
   side effect of running the test suite. That is unacceptable for a reviewed,
   signed-off artefact regardless of whether the bytes happened to match.

### 18.3 Why byte-identical PNG encoding is not a valid requirement

Recorded because it would otherwise be re-added by someone reasoning that
"reproducible" must mean "byte-identical":

- **Pixel reproducibility IS guaranteed.** For a given `portrait-source.png`,
  the generator produces the same decoded RGBA pixels on every machine. That is
  the property that determines what a user sees, and it is what the test now
  asserts.
- **Byte-identical PNG encoding is NOT guaranteed** and must not be required.
  DEFLATE output is implementation-defined; two conforming encoders may emit
  different bytes for identical input. Pillow's `optimize=True` heuristics and
  the linked zlib's compression internals both vary by version and build.

Demonstrated concretely — one image, five encoder settings, on Pillow 12.3.0:

```
decoded RGBA pixels sha256 : 7a0b732ea0a492aa610e1ed05c9d1df943c1c89f064532ea293eb269567e19f7

{'optimize': True}          5dcbb236ad843fa77427c197da7df8cd…   28105 bytes
{'optimize': False}         40825132e945126be6559d1584b11cf2…   28364 bytes
{'compress_level': 1}       37f7a9de208d203e114095d7e42f015b…   39131 bytes
{'compress_level': 6}       40825132e945126be6559d1584b11cf2…   28364 bytes
{'compress_level': 9}       4635c3094d7c2a1cccf7b43755e82c0a…   28151 bytes

distinct encoded hashes: 4        decoded pixels identical in all: true
```

Four file hashes, one pixel hash. A byte comparison would have flagged three of
those as regressions.

**Honest limit on local reproduction.** Installing Pillow 12.3.0 in a clean venv
on this machine produced icons **byte-identical** to the approved files, for all
four sizes. So the reviewer's divergence is not attributable to the Pillow
version alone — the remaining variable is the **zlib build** their Python links
against (this machine reports `zlib 1.2.12` under both Pillow versions). The
exact hash `a1360d47…` was therefore not reproduced here. That does not weaken
the finding: the mechanism is well understood, the demonstration above shows the
class of variation directly, and the fix removes the dependency on it entirely.

### 18.4 The fix

**`tools/make-icons.py`** — added `--output-dir DIR`. Default behaviour is
unchanged: with no argument it writes `assets/icons/` exactly as before. The
module docstring now carries the pixel-vs-byte reproducibility note, so the
constraint is discoverable from the generator as well as from the test.

**`tests/icon-branding.test.js`** — the reproducibility test now:

- generates into a **temporary directory** via `--output-dir`, so
  `assets/icons/` is never written;
- compares **dimensions**, **mode after canonical `convert("RGBA")`**, and
  **SHA-256 of `convert("RGBA").tobytes()`** — decoded pixels, not file bytes;
- still asserts that every generated pixel matches the approved committed icon
  exactly, so a genuine visual regression fails loudly.

Three further tests were added, taking the suite from 438 to **441**:

| Test | Guards |
|---|---|
| `encoded PNG bytes are deliberately NOT asserted` | that the byte comparison is not reintroduced, and that the rationale stays documented in both the test and the generator |
| `running the suite does not mutate the approved icon files` | hashes the four approved icons at module load and re-checks them after the generation test has run. Deliberately **not** `git status`: on this branch the icons are legitimately modified relative to HEAD, so a dirty-vs-HEAD signal would say nothing about whether the suite touched them |
| `the generator accepts --output-dir and leaves assets/icons alone` | that the flag exists and the default remains `assets/icons/` |

### 18.5 Verification

| Check | Result |
|---|---|
| `npm test` (Python 3.14.2 / Pillow 12.1.0) | **441 tests, 441 pass, 0 fail** |
| `npm test` (Pillow **12.3.0** in a clean venv) | **441 tests, 441 pass, 0 fail** |
| Tracked-tree fingerprint before vs after the suite | identical — the suite mutates nothing |
| Approved icon files before vs after the suite | identical |
| Extension ZIP SHA-256 | `91373ce6…` — unchanged from r1 |
| Extension version | `4.4.3` — unchanged |

The Python 3.12.13 environment itself was not available here; Pillow 12.3.0 was
tested on Python 3.14.2. The failing assertion has been removed rather than
made to pass, so the interpreter version no longer affects the outcome.

---

## 19. Final release pass — 2026-08-26

Everything in this section happened after the r2 review. **No file that ships in
the extension was modified**, and the packaged artifact is unchanged:
`saved-posts-library-export-4.4.3.zip` is still
`91373ce6d3ce81e32d8d231de33105119dd416ef63b363bb972e358dcb975a90`.

### 19.1 Manual Chrome validation — recorded, developer-reported

The manual plan was executed in Chrome on **2026-08-26** and every ⚠ BLOCKER
was reported passing, with capture yielding **at least 288 images and 99
videos**.

**Provenance matters and is stated plainly: this was performed by the developer
and is recorded here as their report.** It was not observed or independently
reproduced by the engineer writing this document, who has no browser access.

What that closes:

| Was open | Now |
|---|---|
| §13 item 1 — late `fetch` patching may collapse capture yield | **Closed.** ≥288 images / ≥99 videos in one session. The off-by-default trade-off cost nothing material. |
| §13 item 2 — `activeTab` removal may break popup tab detection | **Closed.** Popup detects the Instagram tab, shows the fallback elsewhere, and reaches the content script without it. |
| §13 item 3 — consent modal and palette unverified visually | **Closed** for the disclosure and the palette. Modal *focus handling* specifically was not reported and is not claimed. |
| §17.8 — all twelve manual Chrome blockers | **Closed**, including §20 (Chrome accepted the CSP with no manifest warning), §22, §23 and §24. |

What was **not** supplied and has deliberately not been invented: the Chrome
version used, console transcripts, exact per-media-type counts, the optional
4.4.0 yield comparison, and network traces. No evidence file for the run exists
in the repository. `MANUAL_CHROME_TEST_PLAN.md` → *Recorded result* carries the
same caveats in full.

The **Instagram Terms of Use risk (§13) is not affected by this** and remains an
unresolved external risk. A passing manual test says nothing about it.

### 19.2 Store screenshots now exist

Six listing screenshots were generated in `assets/store-screenshots/` from the
real 4.4.3 UI, driven by a new build-only tool, `tools/screenshot-harness/`,
which serves the shipped `popup.html` / `gallery.html` / `gallery.js` /
`popup.js` / `tokens.css` unmodified against a stubbed `chrome.*` and a
synthetic library. Invented accounts, invented captions, locally generated
abstract tiles; no real user, post, caption or photograph.

The harness widens **its own copy** of `isAllowedMediaUrl` so local placeholder
tiles render rather than showing broken-image glyphs. `url-allowlist.js` is not
edited, the shipped extension still accepts CDN hosts only, and the harness is
not in the manifest, not in `build.sh`'s file list, and not in the ZIP. This is
disclosed rather than left for a reviewer to notice.

### 19.3 OF-3 closed by deletion

The disqualified marketing screenshots were **removed from the repository**:
`assets/screenshots/screenshot-{1-popup,2-gallery,3-howto,3-videos,4-features}.png`,
`assets/screenshots/raw/README.md`, and `compose_screenshots.py`.

Excluding them from review bundles was never sufficient — they contained real
third-party usernames and photographs of identifiable people and were sitting in
a public git repository. `compose_screenshots.py` additionally framed them on a
pink/violet gradient built from Instagram's own brand stops
(`AURORA_PINK = (225, 48, 108)`, `AURORA_VIOLET = (88, 81, 219)`) under the
headline "Export Instagram Saved Posts"; it had no non-infringing use.

**They remain in git history.** Deleting a tracked file does not remove earlier
commits. Removing them from history would require a rewrite, which is out of
scope here and was explicitly excluded.

**Also still on disk, and not deleted:**
`assets/screenshots/raw/{gallery,popup,videos}.png` — the developer's own
original captures. Gitignored, never committed, and the only copies, so they
were left rather than destroyed. They contain the same third-party usernames and
faces. Do not publish them; delete them locally when no longer wanted.

### 19.4 New finding — OF-4: the Donate button uses a warm gradient

**Severity: low. Not fixed in 4.4.3.**

`gallery.html` styles the donation button:

```css
#donate {
  background: linear-gradient(135deg, #f5af19, var(--accent));
  box-shadow: 0 4px 14px rgba(245, 175, 25, 0.25);
}
```

`#f5af19` is **not** an Instagram brand colour, it is not in the brand-hex list
`tests/compliance.test.js` scans for, and that test passes. So this is not a
trade-dress violation and does not affect the trademark complaint.

It is still a real inconsistency. Several places in this repository —
`MANUAL_CHROME_TEST_PLAN.md` §13 step 3, and the screenshot rules — say the
palette is "teal/slate, no pink, magenta, orange or purple anywhere". An
amber→teal gradient contradicts that as written, and it is visible in store
screenshot 6.

Why it was not fixed: the 4.4.3 package is the artifact an independent reviewer
approved, and its SHA-256 is quoted throughout this document and in the review
bundles. Recolouring one button would invalidate that hash for a cosmetic
change. **The screenshot was left uncropped rather than hiding it.**

Two acceptable resolutions, in order of preference:

1. Recolour `#donate` to the neutral palette in **4.4.4**, and regenerate
   screenshot 6.
2. If the button stays, correct the "no warm hues anywhere" wording to name this
   one exception, so the claim matches the build.

Do **not** resolve it by editing the screenshot.

### 19.5 Analytics and secrets — current state

Verified against the working tree, excluding documentation that describes the
removal and the test that asserts its absence:

| Check | Result |
|---|---|
| `analytics.js` | absent |
| `google-analytics.com` / `googletagmanager` / `analytics.google.com` / `gtag(` / `mp/collect` in shipped code | none |
| Measurement-ID or API-secret pattern in shipped code | none |
| Outbound hosts reachable from shipped code | `instagram.com`, `www.instagram.com`, `buymeacoffee.com`, `www.patreon.com`, `github.com`, `developer.chrome.com`, `tomerhy.github.io`, `www.w3.org` — the last being an XML namespace, not a request |

`tests/compliance.test.js` still asserts that the two specific credentials
shipped through 4.4.0 appear nowhere. They are now **assembled from fragments**
in that file instead of being written out, so the working tree holds no
contiguous copy of a live credential. The assertion is unchanged in strength.
Tests are not packaged, so this did not alter the ZIP.

#### The GA4 secret is NOT revoked

Stated exactly, because the difference matters:

> **GA4 secret revocation requires the property owner to revoke/delete the
> exposed secret in Google Analytics. It was not revoked by this task.**

There is no authenticated access to the Google Analytics property from this
environment, and no such action was attempted. Both the measurement ID and the
API secret that shipped through 4.4.0 remain in this repository's **public git
history**, and removing them from the current tree does not change that. They
must be treated as compromised until the owner revokes them.

The property owner needs to do this by hand, signed in as an Analytics admin:

1. **Google Analytics → Admin → Data Streams →** the stream for this extension.
2. **Measurement Protocol API secrets** → delete the exposed secret.
3. If the stream itself is no longer wanted, delete the data stream, and then the
   property under **Admin → Property → Property settings → Move to trash**.

Until step 2 is done, anyone reading the public history can write events into
that property. That is the whole of the exposure — the secret grants Measurement
Protocol *write* access, not read access to collected data, and not access to
any user's Instagram account or to any Google account.
