# Manual Chrome test plan — Saved Posts Library & Export v4.4.3

Everything in the automated suite runs in Node against a stubbed browser. It
never loads the extension into Chrome. This plan covers what the suite
structurally cannot: whether the remediated behaviour actually holds in a real
page, against real Instagram responses.

**Ten checks here block a truthful submission.** They are marked ⚠ BLOCKER, and
**none of them may be recorded as passed without actually running it in Chrome.**
A static test cannot substitute for any of them.

| ⚠ | § | What it decides |
|---|---|---|
| 1 | §4 | No interception before Start |
| 2 | §5 | Capture starts only after consent |
| 3 | §11 | Stop restores `fetch` and `XMLHttpRequest` |
| 4 | §12 | Popup detects the Instagram tab without `activeTab` |
| 5 | §7 | Capture yield is acceptable after late patching |
| 6 | §8 | Images, videos and carousels are captured correctly |
| 7 | §20 | CDN thumbnails and previews load under the new CSP |
| 8 | §21 | Single and ZIP downloads work under the new CSP |
| 9 | §17 | No Analytics or unknown-domain request appears |
| 10 | §22 | Hostile legacy storage is removed and cannot render or navigate |
| 11 | §23 | **JSON export → clear → import restores and persists** (new in 4.4.3) |
| 12 | §24 | **Malicious JSON import is rejected with no console exception** (new in 4.4.3) |

Items 7, 8 and 10 were new in 4.4.2; items 11 and 12 are new in 4.4.3.

> **Status: this plan was executed on 2026-08-26 against 4.4.3.** Every
> ⚠ BLOCKER was reported as passing. See **Recorded result** at the end of this
> document for exactly what was reported, by whom, and what was *not* reported.
> The plan below is retained unchanged as the reusable procedure.
>
> **The current package is 4.4.5 and this plan has not been re-run against it.**
> It does not need to be re-run in full. Six files differ from 4.4.3: the four
> icons, `manifest.json`'s version field, and three CSS declarations in
> `gallery.html` that recoloured the donation button. **No script, no markup
> structure and no logic changed**, so the code exercised by every behavioural
> check is unchanged. See `COMPLIANCE_EVIDENCE.md` §20.2 and §21.1.
>
> **One step does need redoing: §1 step 4**, the visual check of the icon on the
> `chrome://extensions/` card and at 16px in the toolbar. The icon is the thing
> that changed, and step 4 has been updated to describe the current artwork.
>
> §13 step 3 — "the palette is teal/slate, no pink, magenta, orange, or purple
> anywhere" — is worth a glance too. It is now true of the entire UI; 4.4.4 and
> earlier had an amber donation button that contradicted it.

Items 11 and 12 exist because 4.4.2 shipped a `ReferenceError` in the JSON
import handler — import updated the library in memory and silently never
persisted it. 438 automated tests passed. The bug was only reachable by
executing the real handler, which is exactly what a manual pass does. The CSP in particular is only statically validated
(`tests/csp.test.js`); whether Chrome accepts every directive, and whether the
CDN still loads under it, is unknown until someone runs §20 and §21.

## Before you start

| | |
|---|---|
| Package under test | `saved-posts-library-export-4.4.3.zip` |
| Expected SHA-256 | see `hashes.txt` in this bundle |
| Chrome version | record it in the results table |
| Test account | your own, signed in, with **at least 12 saved posts** including ≥2 videos/reels and ≥2 multi-image carousels |

Set up a **separate Chrome profile** for this. Do not use a profile holding
data you care about — step §18 restarts the browser and several steps clear
extension storage.

Write down your ground truth before you begin, because §8 compares against it:

```
Saved posts in the account:        ____
  of which single images:          ____
  of which videos / reels:         ____
  of which carousels:              ____
  total slides across carousels:   ____
```

Note: a carousel usually yields only its cover image from the grid response.
The full slide set arrives when the post itself is opened. Expect captured
counts to be lower than total slides unless you open the carousels — that is
documented behaviour, not a failure.

---

## 1. Load the unpacked extension

1. Unzip `saved-posts-library-export-4.4.3.zip` to a clean folder.
2. Open `chrome://extensions/`, enable **Developer mode**.
3. **Load unpacked** → select that folder.
4. Confirm the card shows:
   - Name **Saved Posts Library & Export** (no "Instagram" in the name)
   - Version **4.4.3**
   - The **portrait icon** (4.4.4 design): the developer's photograph,
     aspect-fit into a rounded square on a neutral slate plate with a
     rounded-rectangle teal border. The whole head is visible — hair, glasses,
     beard and shoulders — with no part of the face cut. No camera glyph, no
     pink/orange/purple gradient, no verification badge. Check it is
     recognisable in the toolbar at 16px.
     *4.4.3 and earlier used a circular crop; if you see a circle, you have
     loaded the wrong build.*
   - **No errors** and **no warnings**
5. Click **Details** → confirm the permission list reads only:
   *"Read and change your data on instagram.com and www.instagram.com"*.
   There must be no mention of cookies, browsing history, or all sites.

---

## 2. Open Instagram while already signed in

1. In the same profile, go to `https://www.instagram.com/` and sign in
   normally, **through Instagram's own page**. The extension must play no part
   in this.
2. Confirm the extension shows no login prompt, no overlay, no injected field,
   and no request for credentials at any point.
3. Confirm nothing is injected into the page: no floating panel, no checkboxes
   on posts, no extension-drawn UI of any kind.

---

## 3. ⚠ BLOCKER — nothing is collected before Start

1. Do **not** click the extension icon yet.
2. Browse to `https://www.instagram.com/{your-username}/saved/` and scroll
   through several screens of saved posts. Open two posts and close them.
3. Open DevTools on the page → **Console**. Confirm there is **no**
   `[SBE] Capture reader installed` line.
4. Now open the extension's Library:
   `chrome://extensions/` → the card → **Details** → note the extension ID, then
   visit `chrome-extension://<ID>/gallery.html`.
5. Confirm the Library is **empty** — 0 images, 0 videos.
6. Open DevTools on the Library page → Console, and run:
   ```js
   chrome.storage.local.get(null, r => console.log(JSON.stringify(r, null, 2)))
   ```
7. Confirm the result contains **no** `igExporterData` key with any items in it,
   and **no** `sbeConsentAcceptedAt`. Keys such as `igExporterLastSeenAt` and
   `sbeLegacyCleanupAt` are expected and carry no post data.

**Pass condition:** heavy browsing of saved posts, with the extension installed
but never started, produces zero stored records.

---

## 4. ⚠ BLOCKER — no fetch/XHR interception before Start

On the **instagram.com page** console (not the extension page):

1. ```js
   window.fetch.toString()
   ```
   Expect the browser's native form — `function fetch() { [native code] }`.
   If you see a JavaScript body containing `originalFetch` or `SBE`, capture is
   installed when it must not be. **That is a hard fail.**
2. ```js
   XMLHttpRequest.prototype.open.toString()
   XMLHttpRequest.prototype.send.toString()
   ```
   Both must also report `[native code]`.
3. ```js
   window.__sbeCaptureHookInstalled
   ```
   `true` is expected and correct — the script has *loaded*. Loaded is not
   installed; step 1 and 2 are what decide this test.

---

## 5. ⚠ BLOCKER — first-run disclosure and affirmative consent

1. Click the extension icon. Confirm the popup shows the capture controls (not
   an "open Instagram" message) — this is also part of §12.
2. Press **Start capture**.
3. A disclosure dialog must appear **before anything is captured**. Confirm it
   names all seven categories: media URLs, post URLs, usernames, captions,
   timestamps, like counts, hashtags.
4. Confirm it states that password, cookies, session tokens, and two-factor
   codes are never requested or stored.
5. Press **Cancel**. Confirm:
   - the dialog closes,
   - the button still reads **Start capture** (capture did not begin),
   - re-running §3 step 6 still shows no `sbeConsentAcceptedAt`,
   - the page console still shows no `Capture reader installed`.
6. Press **Start capture** again, then **I understand — enable capture**.

---

## 6. Starting capture

1. Confirm the page begins scrolling on its own.
2. Confirm the popup button now reads **Stop capture** and the status says it is
   capturing.
3. On the **page** console, confirm `[SBE] Capture reader installed` now appears.
4. Re-run §4 step 1. `window.fetch.toString()` must **now** show a JS body. This
   is the positive control that proves §4 was measuring the right thing.
5. Confirm the image and video counts in the popup begin rising.

---

## 7. ⚠ BLOCKER — capture yield

This is the functional risk introduced by the remediation: 4.4.1 wraps
`window.fetch` at Start rather than at `document_start`, so any call that
resolved `fetch` earlier in page load is no longer observed. XHR is unaffected.

1. Let capture run until it stops on its own, or until the counts stop rising
   for roughly 30 seconds.
2. Record the final counts.
3. Compare against your ground truth from *Before you start*.
4. Now open two or three carousel posts yourself while capture is still
   running, and confirm the additional slides are picked up.

**Judgement call:** if yield is close to the number of saved posts, this passes.
If yield is drastically low — say under half — the late-patching trade-off has
cost real function and needs addressing before submission.
`COMPLIANCE_EVIDENCE.md` §13 item 1 lists the acceptable fixes. Reverting to
always-on interception is not one of them.

Optional but far stronger evidence: install **4.4.0** in a second profile, run
the same account, and record both numbers.

| | 4.4.1 | 4.4.0 (optional) |
|---|---|---|
| Images captured | | |
| Videos captured | | |

---

## 8. ⚠ BLOCKER — expected vs actual counts, per media type

Confirm each media type is captured correctly, not merely that a total looks
plausible. A total can look right while one type is silently broken.

| Metric | Expected | Actual | Notes |
|---|---|---|---|
| Single images | | | |
| Videos / reels | | | |
| Carousel covers | | | |
| Carousel slides after opening posts | | | |
| Album grouping correct (slides in order, one cover per post) | | | |
| Each video has a playable URL or a post link | | | |

---

## 9. Stopping capture

1. Press **Start capture** again if it self-terminated, let it run briefly.
2. Press **Stop capture**.
3. Confirm the button reverts to **Start capture** and the status reads
   *Stopped*.
4. Confirm the page stops scrolling.
5. On the page console, confirm both:
   - `[SBE] Capture reader removed`
   - `[SBE] Capture stopped; page networking restored`

---

## 10. Collection stops after Stop

1. Note the exact counts.
2. Scroll manually through several more screens of saved posts.
3. Open and close two posts.
4. Confirm the counts do **not** change (the popup polls every 2s, so give it a
   moment).

---

## 11. ⚠ BLOCKER — fetch and XMLHttpRequest are restored

On the page console, after Stop:

1. `window.fetch.toString()` → must report `[native code]` again.
2. `XMLHttpRequest.prototype.open.toString()` → `[native code]`.
3. `XMLHttpRequest.prototype.send.toString()` → `[native code]`.
4. Reload the page. Repeat §4 entirely — a reload must return to the fully
   inert state, because capture status is deliberately never persisted.

---

## 12. ⚠ BLOCKER — popup tab detection without `activeTab`

`activeTab` was removed in 4.4.1. The popup reads `tab.url` to decide which
screen to show; that should still work through the `instagram.com` host
permission alone. This step is what confirms it.

1. On an **instagram.com** tab, open the popup. It must show stats and the
   capture controls.
2. On a **non-Instagram** tab (e.g. `example.com`), open the popup. It must show
   the "open Instagram" screen.
3. On an instagram.com tab, press **Start capture**. It must reach the content
   script — i.e. capture actually starts and the status is not
   *"Reload Instagram page first"* or *"Could not start"*.

**If any of these three fails,** `activeTab` needs restoring in `manifest.json`
and the permission table in `COMPLIANCE_EVIDENCE.md` §3 must be corrected in the
same change.

---

## 13. Gallery display, search, sorting

1. Open the Library from the popup's **Gallery** button.
2. Confirm the header shows **Saved Posts Library** and the non-affiliation
   disclaimer is visible without scrolling or opening a menu.
3. Confirm the palette is teal/slate — no pink, magenta, orange, or purple
   anywhere.
4. Confirm items show author, caption, date and like count where present.
5. Confirm carousel items show a count badge with a **layered-sheets** glyph —
   not two offset rounded squares.
6. Click a carousel badge; confirm slides expand inline.
7. Search a word you know appears in one caption → confirm filtering.
8. Search `@username` → confirm owner filtering.
9. Search `#hashtag` → confirm tag filtering.
10. Clear the search; confirm the full grid returns.
11. Cycle the sort control through every option; confirm the order visibly
    changes and nothing throws.
12. Switch between the Images and Videos tabs.

---

## 14. Downloads and exports

1. Select an image → **Download**. Confirm the file saves and is named
   `saved-post_<timestamp>.jpg`. **No filename may contain "instagram".**
2. Select a video → **Download**. Expect a new tab opening the video for manual
   save (documented CORS behaviour, not a bug).
3. On a carousel → **Download album**. Confirm a `.zip` named after the
   shortcode, containing the slides plus `manifest.json`.
4. **Download library**. Confirm `saved-posts-library-<tab>-<stamp>.zip`, with
   per-author folders.
5. **Export JSON** → confirm `saved-posts-export-<stamp>.json`. Open it and
   confirm `"format": "saved-posts-backup-export"`.
6. **Export CSV** → confirm `saved-posts-<tab>-<stamp>.csv` opens cleanly in a
   spreadsheet, with captions containing commas/newlines intact.
7. **Copy URLs** → paste somewhere and confirm the list.

---

## 15. Import rejects hostile URLs

Import is the one place a user-supplied file reaches storage and is later
fetched. Save this as `malicious-import-test.json` and import it:

```json
{
  "format": "saved-posts-backup-export",
  "formatVersion": 1,
  "images": [
    { "type": "image", "url": "javascript:alert('xss')", "thumbnail": "javascript:alert(1)" },
    { "type": "image", "url": "data:text/html,<script>alert(1)</script>" },
    { "type": "image", "url": "file:///etc/passwd" },
    { "type": "image", "url": "http://localhost:8080/probe.jpg" },
    { "type": "image", "url": "https://evil.example/x.jpg" },
    { "type": "image", "url": "https://evilcdninstagram.com/x.jpg" },
    { "type": "image", "url": "https://cdninstagram.com.evil.example/x.jpg" },
    { "type": "image", "url": "https://scontent.cdninstagram.com/v/t51/legit_n.jpg",
      "postUrl": "javascript:alert(2)",
      "metadata": { "owner": "<img src=x onerror=alert(3)>",
                    "caption": "<script>alert(4)</script>" } }
  ],
  "videos": []
}
```

1. **Export JSON first** so you can restore your library afterwards.
2. Import the file above.
3. Confirm the status reports items rejected — expect **1 accepted, 7 rejected**.
4. Confirm the single surviving item is the `scontent.cdninstagram.com` one.
5. Confirm **no alert dialog appears at any point**.
6. Confirm the surviving item's **caption renders as literal text** — you
   should see the characters `<script>alert(4)</script>` on screen, not an
   executed script and not a blank.
7. Confirm the **owner is absent, not displayed**. This is a real behavioural
   difference and the plan previously got it wrong: `cleanOwner()` rejects any
   value that is not `[A-Za-z0-9._]+`, so a hostile owner is **nulled**, not
   escaped. The item details show no `@` line at all. Do **not** expect to see
   the hostile owner text rendered in any form.
8. Click the surviving item and press **Download**. Confirm it does not navigate
   to `javascript:` (its hostile `postUrl` must have been dropped to null).
9. Re-import your real export to restore the library.

---

## 16. Clear All Data

1. In the popup, press **Clear all data**. Confirm a confirmation prompt appears.
2. Cancel it; confirm nothing was deleted.
3. Press it again and confirm.
4. Confirm counts drop to zero, the toolbar badge clears, and an open Library
   tab re-renders empty.
5. Re-run §3 step 6. Confirm `igExporterData` is empty **and**
   `sbeConsentAcceptedAt` is **gone**.
6. Press **Start capture**. Confirm the **first-run disclosure appears again** —
   clearing data revokes consent by design.
7. Repeat via the gallery's own **Clear all** control.

---

## 17. ⚠ BLOCKER — console, service worker, and network

1. **Page console** (instagram.com): confirm no uncaught errors attributable to
   `[SBE]`. Instagram's own console noise is not in scope.
2. **Popup console**: right-click the popup → Inspect. Confirm no errors.
3. **Library console**: confirm no errors. Confirm a `[Cleanup]` line appears at
   most once per profile, and that it names only `ga_*` keys.
4. **Service worker**: `chrome://extensions/` → the card → **service worker** →
   confirm no errors, and that "Errors" does not appear on the card.
5. **Network — the important one.** Open the Network tab on the Library page,
   clear it, then use the gallery normally including a download and a ZIP.
   Confirm every request goes to `*.cdninstagram.com` or `*.fbcdn.net` and
   nothing else. Specifically confirm **zero** requests to:
   - `google-analytics.com`
   - `googletagmanager.com`
   - `analytics.google.com`
   - any developer-operated or unrecognised domain
6. Repeat on the **instagram.com** page during an active capture. Requests
   should be Instagram's own. Confirm the extension adds no request to any
   analytics or third-party host.
7. Filter the Network tab by `collect` and by `analytics`. Both must be empty.

---

## 18. Donation links require an explicit click

1. In the popup and the gallery, confirm no donation request fires on load —
   check the Network tab, and confirm no new tab opens by itself.
2. Click the popup's coffee link. Confirm it opens `buymeacoffee.com` in a new
   tab, and that the URL carries **no** query parameters about you or your
   library.
3. Click the gallery's **Donate**. Confirm it opens `patreon.com`, same check.

---

## 19. Behaviour after browser restart

1. Capture a handful of items, then quit Chrome entirely.
2. Reopen Chrome and the same profile.
3. Open the Library. Confirm the captured items **survived** the restart.
4. Go to instagram.com. Re-run §4. Confirm capture is **off** — a restart must
   never resume capture.
5. Confirm the toolbar badge reflects unseen items and clears once you open the
   popup.
6. Press **Start capture**. Confirm the disclosure does **not** reappear
   (consent persists across restart; only Clear all data revokes it).

---

## 20. ⚠ BLOCKER — CDN thumbnails and previews load under the new CSP

4.4.2 adds a Content Security Policy to the extension's own pages. It is
validated statically by `tests/csp.test.js`, but **no automated test can tell
you whether Chrome accepts it or whether the CDN still loads under it.** That is
this section.

1. Load the unpacked extension. On `chrome://extensions/`, confirm the card
   shows **no manifest warning**. A rejected CSP directive appears here.
   *If it does:* record the exact error text verbatim in the Notes column — the
   wording matters, because the fix is to narrow to the closest valid directive,
   not to widen the policy.
2. Open the Library with a populated capture. Confirm thumbnails actually
   render.
3. Open the Library's DevTools console. Confirm there is **no**
   `Refused to load the image` / `Refused to connect to` / `violates the
   following Content Security Policy directive` message.
4. Open an item so a preview shows. Confirm the image or video renders.
5. Enter fullscreen on an image and on a video. Both must display.
6. In the Network tab, confirm the thumbnail requests go to
   `*.cdninstagram.com` / `*.fbcdn.net` and return 200 (or a normal CDN 403 for
   an expired URL — that is an expiry, not a CSP block; the console message is
   what distinguishes them).

**If a CSP violation appears:** record the directive named in the error. The
correct response is the narrowest change that makes the real use case work —
never `unsafe-inline`, never a bare scheme, never a wildcard host.

---

## 21. ⚠ BLOCKER — single and ZIP downloads work under the new CSP

`connect-src` is what bounds `fetch()`. If it is wrong, downloads fail.

1. Select an image → **Download**. Confirm the file saves.
2. Select a video → **Download**. Confirm a new tab opens the video.
3. On a carousel → **Download album**. Confirm the ZIP downloads and contains
   the slides plus `manifest.json`.
4. **Download library**. Confirm the per-author ZIP downloads.
5. Throughout, watch the console for `Refused to connect to` — any such message
   is a CSP failure, not a network failure.
6. Confirm the blob-URL download itself works (the ZIP and JSON/CSV exports all
   go through `URL.createObjectURL`). `media-src blob:` is declared for this;
   if a download silently does nothing, check for a CSP message first.

---

## 22. ⚠ BLOCKER — hostile legacy storage is removed and cannot render or navigate

This is the defect 4.4.2 exists to fix: records written by 4.4.0 or earlier were
loaded without validation. Seed exactly such a record and confirm it is
neutralised **and deleted**, not merely hidden.

1. Open the Library, then in its DevTools console:
   ```js
   chrome.storage.local.get('igExporterData', d => {
     const x = d.igExporterData || { images: [], videos: [] };
     x.images.push({
       type: 'image',
       url: 'javascript:alert(1)',
       thumbnail: 'data:text/html,<script>alert(2)</script>',
       postUrl: 'https://evil.example/p/x/',
       postShortcode: '../../etc/passwd',
       innerHTML: '<img src=x onerror=alert(3)>',
       onclick: 'alert(4)',
       srcdoc: '<script>alert(5)</script>',
       metadata: { owner: '<img src=x onerror=alert(6)>',
                   caption: '<script>alert(7)</script>' }
     });
     x.videos.push({
       type: 'video',
       url: 'https://evilcdninstagram.com/video.mp4',
       thumbnail: 'https://cdninstagram.com.evil.example/image.jpg',
       postUrl: 'https://user:pass@scontent.cdninstagram.com/file.jpg'
     });
     chrome.storage.local.set({ igExporterData: x }, () => console.log('seeded'));
   });
   ```
2. Reload the Library.
3. Confirm **no alert dialog appears at any point** — not on load, not on
   hovering, not on clicking anything.
4. Confirm neither hostile record appears in the grid.
5. Confirm a status line reports that unsafe records were removed, with a count.
6. Confirm the console shows `[Gallery] Sanitised library: removed N record(s)`.
7. **Confirm the records are gone from storage**, not filtered at render time:
   ```js
   chrome.storage.local.get('igExporterData',
     d => console.log(JSON.stringify(d.igExporterData)));
   ```
   Neither `javascript:` nor `evilcdninstagram` nor `evil.example` may appear.
8. Reload the Library again. Confirm **no** further "removed N records" message —
   the second pass finds nothing, which is what proves there is no rewrite loop.
9. Seed a record with a valid `postUrl` but no media URL:
   ```js
   chrome.storage.local.get('igExporterData', d => {
     const x = d.igExporterData; x.videos.push({ type:'video', url:null,
       thumbnail:null, postUrl:'https://www.instagram.com/p/Cabc123_/' });
     chrome.storage.local.set({ igExporterData: x });
   });
   ```
   Reload. Confirm this record **survives** — it is valid, and losing it would
   be a bug in the other direction. Open it; confirm the fallback shows "Open
   original post" and that the link goes to instagram.com.
10. Copy URLs and export JSON/CSV. Confirm no hostile URL appears in any output.

---

## 23. ⚠ BLOCKER — JSON export → clear → import round trip

This is the path that was broken in 4.4.2. It must be exercised by hand, not
inferred from a passing test.

1. Capture a handful of items, including at least one carousel and one video.
2. Note the exact counts shown in the popup.
3. In the Library, press **Export JSON**. Confirm a
   `saved-posts-export-<date>.json` file downloads.
4. Open the file in a text editor. Confirm it contains `"format":
   "saved-posts-backup-export"` and your items, and that every `url` begins
   `https://` and points at `cdninstagram.com` or `fbcdn.net`.
5. Press **Clear all data** and confirm. The Library is now empty.
6. Press **Import** and choose the file you just exported.
7. Confirm the status line reports the number imported, with **no** "undefined"
   and **no** "NaN" in the text.
8. Confirm the grid repopulates and the counts match step 2.
9. **Confirm it persisted** — this is the specific 4.4.2 failure. In the
   Library's console:
   ```js
   chrome.storage.local.get('igExporterData',
     d => console.log(d.igExporterData.images.length,
                      d.igExporterData.videos.length));
   ```
   The numbers must match what is on screen. In 4.4.2 they were 0 and 0.
10. **Reload the Library.** The imported items must still be there. If they
    vanish on reload, the import was never written.
11. Confirm the Library console shows **no uncaught exception** at any point —
    in particular no `ReferenceError`.
12. Confirm metadata survived: open an item and check the author, caption, date
    and like count are still shown.
13. Confirm a carousel is still grouped, with its slides in order.

---

## 24. ⚠ BLOCKER — malicious JSON import

Save this as `malicious-import-test.json` and import it:

```json
{
  "format": "saved-posts-backup-export",
  "formatVersion": 1,
  "images": [
    { "type": "image", "url": "javascript:alert('xss')" },
    { "type": "image", "url": "data:text/html,<script>alert(1)</script>" },
    { "type": "image", "url": "file:///etc/passwd" },
    { "type": "image", "url": "https://evilcdninstagram.com/x.jpg" },
    { "type": "image", "url": "https://cdninstagram.com.evil.example/x.jpg" },
    { "type": "image", "url": "https://user:pass@scontent.cdninstagram.com/x.jpg" },
    { "type": "image", "url": "https://scontent.cdninstagram.com/v/t51/ok_n.jpg",
      "postUrl": "javascript:alert(2)",
      "innerHTML": "<img src=x onerror=alert(3)>",
      "onclick": "alert(4)",
      "srcdoc": "<script>alert(5)</script>",
      "metadata": { "owner": "<img src=x onerror=alert(6)>",
                    "caption": "<script>alert(7)</script>" } }
  ],
  "videos": []
}
```

1. Export your real library first so you can restore it.
2. Import the file above.
3. Confirm **no alert dialog appears at any point**.
4. Confirm the status reports 1 accepted and 6 rejected.
5. Confirm exactly one item appears, the `scontent.cdninstagram.com` one.
6. Confirm the Library console shows **no uncaught exception**. A rejected
   import must fail cleanly, not throw.
7. Open the surviving item. Confirm the **caption renders as literal text** —
   you should see the characters `<script>alert(7)</script>` on screen, not an
   executed script and not a blank.
8. Confirm the **owner is absent**, not displayed. `cleanOwner()` rejects any
   value containing markup, so the hostile owner is nulled rather than escaped —
   the item details show no `@` line at all. Do not expect to see the hostile
   owner text rendered.
9. Press Download on that item and confirm it does not navigate to a
   `javascript:` URL.
10. Check storage directly and confirm no hostile value was written:
    ```js
    chrome.storage.local.get('igExporterData',
      d => console.log(JSON.stringify(d.igExporterData)));
    ```
    None of `javascript:`, `data:text/html`, `file://`, `evilcdninstagram`,
    `innerHTML`, `onclick` or `srcdoc` may appear.
11. Reload the Library. Confirm the state is unchanged and still clean.
12. Re-import your real export to restore.

---

## Results

Fill in as you go. Record the Chrome version and the date.

The blank table below is the **reusable template**. The result actually
obtained on 2026-08-26 is recorded in **Recorded result** at the foot of this
document; the template is deliberately left blank so the next run starts clean.

Chrome version: ______________  Date: ____________  Tester: ____________

| § | Check | Pass | Fail | Notes |
|---|---|---|---|---|
| 1 | Unpacked extension loads, no errors/warnings | | | |
| 1 | Name/version/icon correct, permission list minimal | | | |
| 2 | Signed in via Instagram's own page; no extension login UI | | | |
| 2 | Nothing injected into the page | | | |
| 3 | ⚠ No records stored before Start | | | |
| 3 | ⚠ No `sbeConsentAcceptedAt` before consent | | | |
| 4 | ⚠ `window.fetch` native before Start | | | |
| 4 | ⚠ XHR `open`/`send` native before Start | | | |
| 5 | Disclosure appears before first capture | | | |
| 5 | All seven data categories named | | | |
| 5 | Credential disclaimer present | | | |
| 5 | Cancel does not start capture or record consent | | | |
| 6 | Capture starts; reader installs; counts rise | | | |
| 6 | `window.fetch` wrapped during capture (positive control) | | | |
| 7 | ⚠ Capture yield acceptable vs ground truth | | | |
| 8 | Expected vs actual counts recorded | | | |
| 9 | Stop reverts UI and halts scrolling | | | |
| 9 | Both teardown log lines appear | | | |
| 10 | No collection after Stop | | | |
| 11 | `fetch` restored to native | | | |
| 11 | XHR `open`/`send` restored to native | | | |
| 11 | Reload returns to fully inert state | | | |
| 12 | ⚠ Popup detects Instagram tab | | | |
| 12 | ⚠ Popup shows fallback off-Instagram | | | |
| 12 | ⚠ Start reaches the content script | | | |
| 13 | Library renders; disclaimer visible | | | |
| 13 | Neutral palette; no Instagram trade dress | | | |
| 13 | Metadata displayed correctly | | | |
| 13 | Carousel expand works | | | |
| 13 | Search by caption / @owner / #tag | | | |
| 13 | Sorting works | | | |
| 14 | Single image download, correct filename | | | |
| 14 | Video download opens tab | | | |
| 14 | Album ZIP correct | | | |
| 14 | Library ZIP correct | | | |
| 14 | JSON export correct format string | | | |
| 14 | CSV export opens cleanly | | | |
| 15 | Import rejects 7 hostile records, accepts 1 | | | |
| 15 | Caption renders as literal text | | | |
| 15 | Hostile owner is ABSENT, not rendered | | | |
| 15 | No alert fires | | | |
| 15 | Hostile `postUrl` dropped | | | |
| 16 | Clear all data wipes library | | | |
| 16 | Consent revoked; disclosure reappears | | | |
| 16 | Gallery clear control equivalent | | | |
| 17 | No `[SBE]` console errors | | | |
| 17 | No popup / Library console errors | | | |
| 17 | No service-worker errors | | | |
| 17 | Network: only CDN hosts contacted | | | |
| 17 | Network: zero analytics requests | | | |
| 18 | No donation request without a click | | | |
| 18 | Donation links carry no user data | | | |
| 19 | Library survives restart | | | |
| 19 | Capture off after restart | | | |
| 19 | Consent persists across restart | | | |
| 20 | ⚠ Extension loads with no manifest/CSP warning | | | |
| 20 | ⚠ Thumbnails render under the CSP | | | |
| 20 | ⚠ No CSP violation in the Library console | | | |
| 20 | ⚠ Preview and fullscreen media display | | | |
| 21 | ⚠ Single image download works | | | |
| 21 | ⚠ Video download opens a tab | | | |
| 21 | ⚠ Album ZIP downloads | | | |
| 21 | ⚠ Library ZIP downloads | | | |
| 21 | ⚠ No "Refused to connect" during downloads | | | |
| 22 | ⚠ No alert fires from hostile legacy storage | | | |
| 22 | ⚠ Hostile records absent from the grid | | | |
| 22 | ⚠ Removal reported to the user with a count | | | |
| 22 | ⚠ Hostile records DELETED from chrome.storage | | | |
| 22 | ⚠ Second reload reports nothing (no rewrite loop) | | | |
| 22 | ⚠ Valid post-only record survives sanitisation | | | |
| 22 | ⚠ No hostile URL in clipboard / JSON / CSV output | | | |
| 23 | ⚠ Export JSON downloads with correct format string | | | |
| 23 | ⚠ Import repopulates the grid, counts match | | | |
| 23 | ⚠ Status text has no "undefined" / "NaN" | | | |
| 23 | ⚠ **Import PERSISTED — storage matches the screen** | | | |
| 23 | ⚠ **Imported library survives a Library reload** | | | |
| 23 | ⚠ No uncaught exception during import | | | |
| 23 | ⚠ Metadata and carousel grouping survived the round trip | | | |
| 24 | ⚠ Malicious import: no alert fires | | | |
| 24 | ⚠ Malicious import: 1 accepted, 6 rejected | | | |
| 24 | ⚠ Caption renders as literal text | | | |
| 24 | ⚠ Hostile owner is absent, not rendered | | | |
| 24 | ⚠ No hostile value written to storage | | | |
| 24 | ⚠ No uncaught exception on the reject path | | | |

### Overall

- Blockers passed (§3, §4, §5, §7, §8, §11, §12, §17, §20, §21, §22, §23, §24):
  ☐ all pass ☐ one or more failed
- CSP accepted by Chrome with no manifest warning: ☐ yes ☐ no
  If no, exact error text: _______________________________________________
- Capture yield vs 4.4.0 (if measured): 4.4.2 ____ / 4.4.0 ____
- Ready to submit: ☐ yes ☐ no — reason: ______________________________

**Do not mark any ⚠ row as passed on the strength of an automated test.** The
automated suite has 438 passing tests and still cannot see any of the above.
4.4.2 is the proof: it passed 368 tests with a JSON import that never persisted
anything.


---

## Recorded result — 2026-08-26

**Provenance: developer-performed and developer-reported.** The developer ran
this plan against Chrome on their own machine and reported the outcome. It was
not observed, re-run, or independently reproduced by the engineer who wrote this
document, who has no browser access. Read every line below as *"the developer
reported"*, not *"was independently verified"*.

| | |
|---|---|
| Date | 2026-08-26 |
| Performed by | the developer (extension author) |
| Reported to | this remediation task |
| Build under test | `saved-posts-library-export-4.4.3.zip`, SHA-256 `91373ce6d3ce81e32d8d231de33105119dd416ef63b363bb972e358dcb975a90` |
| Extension version | 4.4.3 |
| Independently reproduced | No |
| Still current? | **No — the package is now 4.4.5.** This row set is the accurate record of what was tested and is deliberately not rewritten to the newer hash. See the Status note at the top of this document for which checks carry over. |

### Reported outcome

- **All ⚠ BLOCKER checks passed.** That is §3, §4, §5, §7, §8, §11, §12, §17,
  §20, §21, §22, §23 and §24 — including the three that had never been run in a
  browser before (§20 CSP acceptance, §21 downloads under CSP, §22 hostile
  legacy storage) and the two added in 4.4.3 (§23 import round trip, §24
  malicious import).
- **Capture yield (§7):** at least **288 images** and **99 videos** captured in
  a single session. This is the number that retires the late-`fetch`-patching
  functional risk: wrapping `fetch` at Start rather than at `document_start`
  did **not** collapse capture. It is a floor, not an exact count — see
  *Not reported* below.
- **§20 specifically:** Chrome accepted the manifest with the new
  `content_security_policy.extension_pages` value and showed no manifest
  warning; CDN thumbnails and previews rendered.
- **§23 specifically:** the JSON export → clear → import round trip persisted.
  This is the exact defect that made 4.4.2 unshippable, and it is the one
  result here that could never have come from the automated suite.

### Not reported — recorded as unknown rather than filled in

These were **not supplied** and have deliberately **not** been invented:

- The **Chrome version** used. The Results table's Chrome-version field is
  therefore left blank.
- **Console log transcripts** for any section.
- **Exact unique-post counts**, per-media-type breakdowns for §8, or the
  optional 4.4.0 side-by-side yield comparison in §7. "At least 288 images and
  99 videos" is the whole of what was reported about counts.
- **Network traces** or HAR captures for §17.
- Per-row pass marks for the **non-blocker** rows. The report covered the
  blockers; the remaining rows are unrecorded, not failed.

No evidence file for this run exists in the repository. The record above is a
report, and is labelled as one.

### Effect on the open-blocker list

The twelve manual-browser blockers tracked in `COMPLIANCE_EVIDENCE.md` §17.8
are **closed on the strength of a developer report**. What is *not* closed by
this run, and is not a browser question at all:

- **Instagram Terms of Use risk** (`COMPLIANCE_EVIDENCE.md` §13). Automating
  scrolling and reading the account's own saved-post responses may conflict with
  Instagram's Terms regardless of how the extension behaves technically. A
  passing manual test says nothing about it. It remains an **unresolved
  external risk** and is not affected by this result.
