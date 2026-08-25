# Compliance evidence — Saved Posts Backup & Export

Prepared 25 August 2026 in response to:

| | |
|---|---|
| Removed item name | Instagram Saved Media Exporter |
| Chrome Web Store item ID | `hllpcahjefcijlmlnhlmhjemcgkgdgh` |
| Google case | 79-1827699 |
| Netcraft issue | 91984778 |
| Removed published version | 4.3.10 |
| Remediated version | 4.4.1 |

Nothing in this repository has been published, submitted, or appealed. The
package described below exists locally only.

---

## 0. Read this first — what was and was not verified

Being precise about this is the point of the document.

**Version 4.3.10 was located and audited at source level.** It exists in this
repository as annotated git tag `v4.3.10`, pointing at commit
`f3fccd56e4153ee6f14901f86a970658263836ae`, whose `manifest.json` reads
`"version": "4.3.10"`. That tree was extracted and inspected file by file.

**One limitation, stated plainly:** the *published ZIP* for 4.3.10 could not be
located — no release artifact for it exists in this repository, and the Chrome
Web Store copy is not retrievable now that the item is removed. Every 4.3.10
statement below therefore describes **the source at tag `v4.3.10`**, which is
the best available evidence but is not byte-proof that the uploaded package was
built from exactly that tree. Nothing here should be read as "the published
4.3.10 artifact was inspected", because it was not.

| Claim | 4.3.10 (source at tag) | 4.4.0 (repo HEAD before this work) | 4.4.1 (remediated) |
|---|---|---|---|
| Audited | Yes — source tree | Yes — source tree | Yes — source + built ZIP |
| Built ZIP hashed | No — no artifact exists | No | Yes (§2) |
| Tests executed against it | No — the suite has since changed | Baseline 268 passing | 323 passing (§10) |

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

## 2. Final package

| | |
|---|---|
| Path | `saved-posts-backup-export-4.4.1.zip` (repository root) |
| Size | 102,376 bytes |
| **SHA-256** | `1ade0a8db533d5a38e578ed7ac32627805d4d887879c812e7aec52feca51ab1e` |
| Built by | `./build.sh` — **reproducible**: entry mtimes are normalised and the entry order is locale-independent, so rebuilding identical sources reproduces this exact hash. Verified by building three times. |
| `manifest.json` at root | Yes — asserted by `tests/build.test.js` |

Contents (17 files), with per-file SHA-256:

```
f449b326f5754b46d732db4b3592f2628cf5f9e5963ad1fd382cf30b7de9e900  assets/icons/icon-128.png
4a1bd1596008cf682ba9208b740a69ea58c2c7e39e2e1d4cd37abb8333e90c38  assets/icons/icon-16.png
2929861b579d0a93d86f9a733dd835da2d03ec246397782e0fb49f7f59690b62  assets/icons/icon-32.png
b1b11b2827b68821a6d03d526db0a2c65a60fa3abcde9b7ffc7f38cc002efa78  assets/icons/icon-48.png
50bd3f8a612c18e321f6585404482aa5224ca2fd77886c2da764f592d795ac30  background.js
fb24d1d5ab9f74bc677976a5b84460913a7060b84dc97ae5bd2eb5c4131d22e7  capture-hook.js
f5903b06ea621077f9593a7487efafbc6529ee6888a6734fe1e8d0695edd59a6  content.js
7a1677e2b38c1daddbb3e76e0a9287b7e7580a85d7585473d68be91539bb962b  gallery.html
2ab54c0f2947069293fca70d4705c8316b8e265cc1abf2b5ad291413b467b5cc  gallery.js
8b3db170a8c1337fb1f5ef12b3ce1bf1c9949988e0ef2186016ec15adae1e13d  legacy-cleanup.js
acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e  lib/jszip.min.js
773115d37f69d9c350bc77f592bd14708458117a55263190caabb351c3bfb74e  manifest.json
9795463eda40716e5c603a289637065f6c953a5eb565d3bd7da69d6acbad1c2e  popup.html
e8796357411a35365f60207e3496ecd2774b667c9b230a20df2511df82634c6b  popup.js
74b1b4e92d0974e695b623089df0cda93b8f12750db0362e59a854d6921f434d  privacy-policy.html
7ba96e7f53dcabae3ebfad6ef71e950d768e5f37e9382ce0748889256a08871f  tokens.css
e6df78b52368cce75f0a0d5c83240a581932abe807bf0b9dad26721f4a85a07a  url-allowlist.js
```

Absent from the package, and asserted absent by `tests/build.test.js`:
`analytics.js`, `autoplay.js`, `injector.js`, `content-styles.css`,
`assets/icons/maker.png`, `assets/icons/icon-source.png`,
`assets/screenshots/`, `tools/`, `tests/`, `.claude/`, `.git/`, `.venv/`,
`node_modules/`, `package.json`, `index.html`, `README.md`, `*.map`, `.DS_Store`.

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
       Media bytes are fetched from the CDN only on an explicit Download.
```

Nothing in this flow leaves the device except step-by-step CDN fetches of the
user's own media, initiated by an explicit click.

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
grep -n 'G-PX8PH6ZQED\|XsR9YFyZQY2'         → no matches anywhere in the repo
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

### Requires manual verification in Chrome — I could not test in a browser

1. **Late `fetch` patching may miss requests.** This is the most important open
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

2. **`activeTab` removal.** The popup reads `tab.url` to decide which screen to
   show. Chrome supplies `Tab.url` when the extension has either the `tabs`
   permission or host access to that tab, and we have host access to
   `instagram.com`. Messaging the extension's own content script needs no extra
   permission. I am confident but could not execute it: **confirm the popup
   still shows the capture controls on an Instagram tab, and still reaches the
   content script.** If it regresses, restore `activeTab` and justify it.

3. **Consent modal and palette rendering.** Unverified visually. Check the
   modal's focus handling and that no element still reads as Instagram-styled.

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
