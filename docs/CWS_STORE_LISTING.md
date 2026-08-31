# Chrome Web Store listing — Saved Posts Library & Export v4.4.4

Copy-ready listing text. **Nothing here is submitted automatically.**

> ## This is a NEW ITEM, not a resubmission
>
> Chrome Web Store Developer Support refused to reinstate the removed item on
> **2026-08-27** and named the only remaining route: *"you may consider
> releasing a new, non-infringing version of your item on the Chrome Web Store
> under a new package name."* See `COMPLIANCE_EVIDENCE.md` §20.1.
>
> That has concrete consequences for how this listing is filed:
>
> - **Create a new item in the dashboard and upload
>   `saved-posts-library-export-4.4.4.zip` to it.** Do not attempt to update
>   item `hllpcahjefcijlmlnhlmhjemcgkgdghh`; it is permanently removed. The new
>   item gets a new extension ID.
> - **Do not re-appeal the old item.** The stated bar is that a removal is
>   reversed "only if an error was made", and the removed build genuinely did
>   carry Instagram's gradient, a camera glyph and "Instagram" in its name. The
>   reply also warns that further violations may suspend the publisher account.
> - **Check two things first**, both outside this repository: that the publisher
>   account is still in good standing, and that the Instagram Terms of Use
>   question (`COMPLIANCE_EVIDENCE.md` §13) is one you are willing to submit
>   under. Google made both a condition of republishing.
> - **The trademark complaint is not resolved by any of this.** Google recused
>   itself and directed the developer to the complainant. Nothing in this
>   document is legal advice, and filing a new item does not answer the
>   complaint.
>
> There is no install base, no review history and no rating to carry over. The
> listing should read as a first release, because for this item it is one.

Deliberately absent, because the previous listing's problems were partly
linguistic: no "official", no "approved", no "best", no "#1", no "the only",
no urgency, and no Instagram logo, wordmark, badge, or gradient anywhere in the
copy or the assets.

---

## Corrections in 4.4.2 — read this before reusing any earlier copy

An independent review found the 4.4.1 listing made claims the software does not
support. Every one is corrected below, and the reason is recorded so the same
wording does not creep back:

| 4.4.1 claim | Why it was wrong | 4.4.2 wording |
|---|---|---|
| "your collection survives … a deleted post" | Capture stores a URL, not the file. If the post is deleted the CDN URL stops resolving and nothing is recoverable. | Removed. Only an explicit download produces a file that survives. |
| ~~Everything works offline once captured~~ | The library metadata works offline; media does not, because previews and downloads fetch from the CDN. | "Browse your captured library offline; media itself is fetched when you view or download it." |
| Implied that capture produces a local media backup | Capture produces links + metadata. Files exist only after Download or a ZIP action. | Stated explicitly and repeatedly. |
| ~~does not download other people's private posts~~ | Wrong framing. A post saved from a private account the user follows *is* processed — legitimately, because the user is already authorised to see it. | "It never accesses content you are not already authorised to view." |
| ~~Downloads only your own media~~ | The media belongs to whoever posted it. The user's own act is *saving* it. | "media from posts you saved"; ownership statement added. |
| ~~Two permissions are requested~~ | There are two API permissions **and** host access — three things a reviewer counts. | All three listed separately. |

## Title (45 char limit)

```
Saved Posts Library & Export
```

28 characters. The word "Instagram" does not appear in the title, and must not
appear in the developer/publisher name either.

## Short description (132 char limit)

```
Capture links and details from posts you saved, browse a local library, and download selected media. Not affiliated with Instagram.
```

130 characters. Matches `manifest.json` → `description` exactly — the manifest
description, this listing summary, and the actual behaviour must agree, and a
reviewer will diff them.

---

## Full description

```
Saved Posts Library & Export keeps a local library of the posts you have saved
on instagram.com — the links and the details — and lets you download the media
you choose to keep.

Independent third-party extension. Not affiliated with, authorized by,
endorsed by, or sponsored by Instagram or Meta.


WHAT IT ACTUALLY DOES

Two separate steps, and the difference matters:

1. CAPTURE builds a local library of links and details — media URLs, post
   links, usernames, captions, dates, like counts, hashtags, album structure.
   This is stored on your computer. It is not the media files themselves.

2. DOWNLOAD saves actual files. When you press Download, or build a ZIP, the
   extension requests those media files from Instagram's CDN and saves them to
   your computer. Only files you download this way are yours to keep offline.

Captured links can stop working. Instagram's media URLs expire, and a deleted
post stops resolving. A captured library is therefore not a permanent backup of
the media on its own — download what you want to keep.


HOW IT WORKS

1. Open your saved posts on instagram.com and sign in as you normally would.
2. Click the extension icon and press "Start capture".
3. The extension scrolls the page so more of your saved posts load, and records
   the links and details it sees.
4. Press "Stop capture" when you have enough — or just close the tab.
5. Open the Library to browse and search, then download what you want.

Capture is off until you press Start. Opening instagram.com does not start it,
and reloading the page turns it off again.


WHAT YOU GET

• A searchable local library of the posts you saved
• Post details kept with each item: author, caption, date, like count, hashtags
• Multi-image albums kept together, in order
• Download individual images and videos as files
• ZIP download for a whole album, or for your library grouped by author
• Search by caption, @author, or #hashtag; sort by date or author
• JSON export and import, so your library is portable between browsers
• CSV export for spreadsheets
• Browsing and searching your library works offline. Viewing a preview or
  downloading a file needs a connection, because the media is fetched from
  Instagram's CDN at that moment.


PRIVACY

• Your library is stored on your own computer, in Chrome's local extension
  storage. It is not uploaded anywhere.
• No analytics. No tracking. No advertising. No developer server.
• The extension never asks for, reads, or stores your password, your cookies,
  your session tokens, or your two-factor codes. There is no login form
  anywhere in it.
• It uses the session you are already signed into, only by reading the page you
  are already looking at.
• When the Library shows a preview, or when you download, your browser requests
  that media from Instagram/Meta CDN addresses. That is the only outbound
  traffic, and it goes to Instagram, not to the developer.
• Three things are requested and nothing else: the "storage" permission, the
  "unlimitedStorage" permission, and access to instagram.com.
• Delete everything at any time with "Clear all data".

Full privacy policy: [YOUR PRIVACY POLICY URL]


WHAT THIS IS NOT

This extension does not work around any login, paywall, or content restriction,
and it cannot see anything you could not already see yourself in your own
browser. It never accesses content you are not already authorised to view.

If you follow a private account, posts you saved from it are visible to you, and
the extension can therefore process them — because you already have access. It
gains you no access you did not already have.

The content itself still belongs to whoever posted it. Saving a copy for
yourself is not the same as owning it, and redistributing it is your
responsibility, not the extension's.

You are responsible for your own use of instagram.com, including its Terms of
Use.


WHAT THIS VERSION DOES

• Records loaded from storage are sanitised on the way in, not just on import,
  so a URL saved by an older build cannot reach the gallery unvalidated. The
  cleaned library is written back, so unsafe values are removed permanently.
• Every place a URL is displayed, fetched, opened, copied or exported
  re-checks it against a fixed allowlist of Instagram/Meta addresses.
• The video fallback view is built with DOM methods instead of assembled HTML,
  so no stored value can become markup.
• Added a Content Security Policy restricting the extension's own pages.
• Renamed for accuracy: it maintains a library and downloads on request, rather
  than making a complete backup by itself.
• Corrected the store description and privacy policy where they overstated what
  capture produces.
```


---

## Single-purpose explanation (dashboard field)

```
This extension has one purpose: to help a signed-in user keep a local library of
the posts they have saved, and download media from them on request. When the
user explicitly starts a capture, it reads the saved-post data the browser has
already received for the page they are viewing and stores the links and details
locally. The gallery then lets the user browse and search that library, and
download selected media as files, ZIP archives, JSON, or CSV. It does nothing
else.
```

The unrelated video-autoplay feature that existed through 4.4.0 was removed in
4.4.1 specifically because it was a second, unrelated purpose.

---

## Permission justifications

Three separate things are requested. Listing them as "two permissions" was one
of the 4.4.1 inaccuracies — a reviewer counts host access too.

| # | What is requested | Justification for the dashboard |
|---|---|---|
| 1 | `storage` permission | Stores the user's captured library and preferences locally via `chrome.storage.local`. This is the only data store; it is where the library lives so the gallery can display it after the tab closes. |
| 2 | `unlimitedStorage` permission | Raises Chrome's default local-storage quota. A library of several thousand records carrying captions and album metadata can exceed the default limit; without this a capture fails partway and the user loses what they were collecting. Grants no data access — it only raises a size limit. |
| 3 | Host access to `https://www.instagram.com/*` and `https://instagram.com/*` | The only site the extension works on. Needed so the content scripts can run on the saved-posts pages, and so the popup can tell whether the active tab is that site. |

**Not requested, and worth saying explicitly:** the Instagram/Meta CDN hosts are
*not* in `host_permissions`. When the gallery shows a preview or downloads a
file, the browser makes an ordinary cross-origin request that succeeds only
because the CDN serves permissive headers. The extension has no elevated access
to those hosts. The Content Security Policy names them in `connect-src`,
`img-src` and `media-src` so that those requests are *permitted but bounded* —
CSP restricts, it does not grant.

Not requested: `cookies`, `webRequest`, `declarativeNetRequest`, `history`,
`identity`, `debugger`, `management`, `nativeMessaging`, `downloads`, `tabs`,
`scripting`, `activeTab`, `<all_urls>`.

---

## Privacy summary (for the listing body or the notes field)

```
The captured library — links and post details — stays on the user's device in
chrome.storage.local. The extension does not transmit that library to the
developer, to analytics services, to advertising services, or to unrelated
third parties; there is no developer server and no analytics of any kind.

When the gallery displays a preview or the user downloads media, the browser
requests that media from Instagram/Meta CDN addresses on a fixed allowlist.
That is the only outbound traffic the extension causes, it goes to Instagram
rather than to the developer, and downloads happen only on an explicit click.

The extension requests no cookie, credential, or network-interception
permission, contains no login form or password field, and never reads
passwords, cookies, session tokens, authentication headers, or two-factor
codes. Capture is inactive until the user presses Start. The user can delete
everything at any time from either the popup or the gallery.
```

---

## Non-affiliation disclaimer

Must appear verbatim in the store description, the popup About dialog, and the
privacy policy — it is in all three as of 4.4.1:

```
Independent third-party extension. Not affiliated with, authorized by,
endorsed by, or sponsored by Instagram or Meta.
```

---

## Reviewer test instructions

Paste into **Instructions for reviewers**. Written so the reviewer can verify
the off-by-default claim themselves rather than taking it on trust.

```
No account credentials are needed from us, and none are needed by the
extension. To exercise it you will need to be signed in to instagram.com in
your own test browser with at least one saved post.

The extension never asks for login information. There is no sign-in step, no
form, and no password field anywhere in it.

VERIFY CAPTURE IS OFF BY DEFAULT (the key behaviour of this version)

1. Load the extension and open https://www.instagram.com/ — do NOT click the
   extension icon.
2. Open DevTools on the page and run:  typeof window.fetch
   Then check the page console: you should see no "[SBE] Capture reader
   installed" line. window.fetch is the browser's own, unwrapped.
3. Open chrome://extensions → "service worker" → console, then run in the page
   console:  chrome.storage  (not available in the page — expected).
   Instead, open the extension's Library page and confirm it is empty.
4. Scroll your saved posts for a while with the extension installed but never
   started. Reopen the Library: still empty. Nothing was captured.

VERIFY CAPTURE ONLY STARTS ON A CLICK

5. Navigate to https://www.instagram.com/{your-username}/saved/
6. Click the extension icon. Press "Start capture".
7. A first-run disclosure appears listing exactly what will be read (media
   URLs, post URLs, usernames, captions, timestamps, like counts, hashtags) and
   stating that no password, cookie, session token, or 2FA code is requested.
   Nothing is captured until you accept it.
8. Accept. The page begins scrolling and counts rise in the popup. The page
   console now logs "[SBE] Capture reader installed".

VERIFY STOP RESTORES THE PAGE

9. Press "Stop capture". The console logs "[SBE] Capture reader removed" and
   "[SBE] Capture stopped; page networking restored".
10. window.fetch is back to the browser's own function. Reloading the page also
    resets to the off state — capture status is never persisted.

VERIFY STORAGE AND DELETION

11. Press "Library" to open the gallery. Captured posts appear with author,
    caption, date, and like count. Search and sort work offline.
12. Try "Download album" on a carousel post and "Export JSON" — files are named
    saved-posts-*.zip / saved-posts-export-*.json. No filename contains
    "instagram".
13. Press "Clear all data" in the popup (or "Clear all" in the gallery) and
    confirm. The library empties, and the first-run disclosure will be shown
    again before the next capture.

VERIFY NO NETWORK EGRESS

14. Open the Network tab on the extension's Library page and use it normally.
    The network model has two tiers, and the first one is easy to mistake for a
    violation if you are not told about it:

    AUTOMATIC (no click on Download required):
      - Opening the Library issues requests to *.cdninstagram.com /
        *.fbcdn.net for the thumbnails it is drawing. The library stores media
        URLs, so displaying a grid means fetching those images.
      - Opening a preview or a fullscreen view fetches that media the same way.

    EXPLICIT (only on your click):
      - Download, Download album and Download library fetch media so it can be
        saved to disk.
      - The support links (buymeacoffee.com, patreon.com), the privacy-policy
        link and the GitHub link navigate only when clicked. The extension
        attaches no library data and no identifier to any of them.

    MUST NOT APPEAR AT ALL:
      - any request to google-analytics.com, googletagmanager.com or
        analytics.google.com
      - any developer-operated server or telemetry endpoint
      - any host other than the two CDN wildcards and the click-only
        destinations above

    Filter by "collect" and by "analytics" — both must be empty.
15. Optional donation links (buymeacoffee.com, patreon.com) only open on an
    explicit click and carry no data.

VERIFY THE CONTENT SECURITY POLICY

16. chrome://extensions -> Details. Confirm the extension loads with no manifest
    warning. The CSP restricts script-src to 'self', blocks objects and frames,
    and limits connect/img/media-src to 'self' plus *.cdninstagram.com and
    *.fbcdn.net.
17. Open the Library. Confirm thumbnails render (img-src permits the CDN) and
    that the console shows no "Refused to load" / "Refused to connect" CSP
    violation.
18. Run a single download and a ZIP download. Both must succeed — they exercise
    connect-src. Any CSP violation here is a blocker, not a cosmetic issue.

VERIFY HOSTILE LEGACY STORAGE IS REMOVED

19. With the Library open, run in its console:
      chrome.storage.local.get('igExporterData', d => { const x =
        d.igExporterData || {images:[],videos:[]};
        x.images.push({type:'image',url:'javascript:alert(1)',
          thumbnail:'data:text/html,alert(1)',
          postUrl:'https://evil.example/p/x/',
          metadata:{owner:'<img src=x onerror=alert(1)>'}});
        chrome.storage.local.set({igExporterData:x}); })
    This is exactly the shape a 4.4.0-era record could have.
20. Reload the Library. Confirm: no alert fires; the hostile record does not
    appear; a status line reports that unsafe records were removed; and
    re-reading chrome.storage.local shows the record is GONE from storage, not
    merely hidden.

NOTE ON PREVIOUS VERSIONS

Version 4.4.0 and earlier contained a Google Analytics client and started
reading API responses as soon as an Instagram page loaded. Version 4.4.1 fixed
both but still loaded pre-existing stored records without validating them.
Version 4.4.2 fixes that, and adds a CSP. Static scans covering all of it are
in tests/; run `npm test` in the source tree to execute all 368 tests.
```

---

## Statements on credentials and session use

Include both verbatim wherever the dashboard allows free text:

```
No Instagram login information or credentials are requested. The extension has
no login form, no password field, and no permission that would let it read
cookies, request headers, or authentication tokens.
```

```
The extension uses the user's existing Instagram session only through the
visible instagram.com page in their own browser. It reads responses the page
has already received and does not access authentication data, does not issue
authenticated API calls of its own, and does not bypass any login or access
control.
```

---

## Screenshots

**Upload these six, in this order.** They are in `assets/store-screenshots/`,
generated from the real 4.4.4 UI with synthetic data (the version badge in
frames 1 and 3 reads `v4.4.4`):

| # | File | Caption to use (optional) |
|---|---|---|
| 1 | `01-popup-idle.png` | Capture is off until you start it. |
| 2 | `02-first-run-disclosure.png` | The first-run disclosure names everything that gets recorded. |
| 3 | `03-library.png` | Your saved posts as a searchable local library. |
| 4 | `04-search.png` | Search by caption, @account or #tag. |
| 5 | `05-album-expanded.png` | Carousels stay grouped, with slides in order. |
| 6 | `06-videos-and-export.png` | Export as JSON or CSV, or download a ZIP. |

Frames 1 and 2 are 440×720 (the popup's real size); frames 3–6 are 1280×800.

**The old `assets/screenshots/*.png` files have been deleted from the
repository**, along with `compose_screenshots.py`. They showed the old
pink/purple UI *and* real third-party Instagram data — at least three
identifiable usernames, photographs of identifiable people, and real captions.
That was a privacy problem, not just a branding one, and excluding them from
bundles did not fix it while they sat in a public repository. Do not restore
them from git history for any purpose.

The rules every frame was held to, how to regenerate the set, and the one
honest blemish left visible in frame 6 (the Donate button's amber gradient) are
all in `SCREENSHOT_PLAN.md`.

Still to produce: the small tile / marquee promotional image, and an OG image if
one is wanted. Both are bound by the same rules.
