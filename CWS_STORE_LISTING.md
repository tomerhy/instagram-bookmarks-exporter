# Chrome Web Store listing — Saved Posts Backup & Export v4.4.1

Copy-ready listing text. **Nothing here is submitted automatically.**

Deliberately absent, because the previous listing's problems were partly
linguistic: no "official", no "approved", no "best", no "#1", no "the only",
no urgency, and no Instagram logo, wordmark, badge, or gradient anywhere in the
copy or the assets.

---

## Title (45 char limit)

```
Saved Posts Backup & Export
```

27 characters. The word "Instagram" does not appear in the title, and must not
appear in the developer/publisher name either.

## Short description (132 char limit)

```
Back up your own saved posts to your computer: images, videos, albums, captions. Independent tool, not affiliated with Instagram.
```

129 characters. Matches `manifest.json` → `description` exactly.

---

## Full description

```
Saved Posts Backup & Export makes a local copy of the posts you have saved on
instagram.com, so your collection survives a lost account, a deleted post, or
simply going offline.

Independent third-party extension. Not affiliated with, authorized by,
endorsed by, or sponsored by Instagram or Meta.


HOW IT WORKS

1. Open your saved posts on instagram.com and sign in as you normally would.
2. Click the extension icon and press "Start capture".
3. The extension scrolls the page so more of your saved posts load, and records
   what it sees.
4. Press "Stop capture" when you have enough — or just close the tab.
5. Open the Library to browse, search, and download what you captured.

Capture is off until you press Start. Opening instagram.com does not start it,
and reloading the page turns it off again.


WHAT YOU GET

• Images and videos saved as files on your computer
• Multi-image albums kept together, in order
• ZIP download for a whole album, or for your entire library grouped by author
• Post details preserved: author, caption, date, like count, hashtags
• Search your library by caption, @author, or #hashtag
• Sort by date captured, date posted, or author
• JSON export and import, so your backup is portable
• CSV export for spreadsheets
• Everything works offline once captured


PRIVACY

• Your captured library is stored on your own computer, using Chrome's local
  extension storage. It is not uploaded anywhere.
• No analytics. No tracking. No advertising. No developer server.
• The extension never asks for, reads, or stores your password, your cookies,
  your session tokens, or your two-factor codes. There is no login form
  anywhere in it.
• It uses the session you are already signed into, only by reading the page you
  are already looking at.
• Two permissions are requested: local storage, and access to instagram.com.
  Nothing else.
• Delete everything at any time with "Clear all data".

Full privacy policy: [YOUR PRIVACY POLICY URL]


WHAT THIS IS NOT

This extension does not download other people's private posts, does not work
around any login, paywall, or content restriction, and cannot see anything you
could not already see yourself in your own browser. It only makes a copy of
what is already on your screen.

You are responsible for your own use of instagram.com, including its Terms of
Use, and for respecting the rights of the people whose posts you save.


VERSION 4.4.1

• Removed Google Analytics entirely. Earlier versions sent usage events and a
  persistent identifier to Google; that code, its keys, and its host permission
  are gone, and the leftover identifiers are deleted from your browser on first
  run.
• Capture no longer starts on its own. Earlier versions read API responses from
  the moment an Instagram page loaded; now nothing is read until you press
  Start, and pressing Stop restores the page completely.
• Added a first-run disclosure explaining exactly what is read and stored.
• Removed the unrelated video-autoplay feature.
• Removed the activeTab permission and the google-analytics.com host permission.
• New name, new icon, neutral design — no resemblance to Instagram's branding.
• Rewrote the privacy policy to describe what the code actually does.
```

---

## Single-purpose explanation (dashboard field)

```
This extension has one purpose: to let a signed-in user save a local backup
copy of their own saved posts. When the user explicitly starts a capture, it
reads the saved-post data the browser has already received for the page they
are viewing, stores it locally, and provides a gallery to browse, search, and
download that library as files, ZIP archives, JSON, or CSV. It does nothing
else.
```

The unrelated video-autoplay feature that existed through 4.4.0 was removed in
4.4.1 specifically because it was a second, unrelated purpose.

---

## Permission justifications

| Permission | Justification for the dashboard |
|---|---|
| `storage` | Stores the user's captured library and preferences locally via `chrome.storage.local`. This is the only data store; it is where the backup lives so the gallery can display it after the tab closes. |
| `unlimitedStorage` | Raises Chrome's default local-storage quota. A saved collection with captions and album metadata can exceed the default limit; without this, a capture fails partway and the user loses the backup. Grants no data access — only a size limit. |
| Host access to `https://www.instagram.com/*` and `https://instagram.com/*` | The only site the extension works on. Needed so the content scripts can run on the saved-posts pages, and so the popup can tell whether the active tab is that site. |

Not requested: `cookies`, `webRequest`, `declarativeNetRequest`, `history`,
`identity`, `debugger`, `management`, `nativeMessaging`, `downloads`, `tabs`,
`scripting`, `activeTab`, `<all_urls>`.

---

## Privacy summary (for the listing body or the notes field)

```
All captured data stays on the user's device in chrome.storage.local. Nothing
is transmitted to the developer or to any third party — there is no developer
server and no analytics. The extension requests no cookie, credential, or
network-interception permission, contains no login form or password field, and
never reads passwords, cookies, session tokens, authentication headers, or
two-factor codes. Capture is inactive until the user presses Start, and the
user can delete all stored data at any time from either the popup or the
gallery.
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
    The only requests are to *.cdninstagram.com / *.fbcdn.net, and only when
    you press Download or a ZIP button — these fetch the user's own media files
    so they can be saved. There are no requests to any developer-operated
    server and none to any analytics endpoint.
15. Optional donation links (buymeacoffee.com, patreon.com) only open on an
    explicit click and carry no data.

NOTE ON THE PREVIOUS VERSION

Version 4.4.0 and earlier contained a Google Analytics client and started
reading API responses as soon as an Instagram page loaded. Both are removed in
4.4.1. Static scans covering this are in tests/compliance.test.js; run
`npm test` in the source tree to execute all 323 tests.
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

## Screenshots — action required before submitting

**Do not reuse the existing screenshots in `assets/screenshots/`.** They were
captured against the old pink/purple UI and show Instagram's own page chrome
and real post content. Recapture all of them:

- Show only the extension's own surfaces: the popup, the first-run disclosure,
  and the Library page in the new neutral palette.
- Do not include the Instagram logo, wordmark, or any official asset.
- Where a screenshot must show a page from the site, keep it incidental, and
  use your own test content — not identifiable third-party posts.
- The promotional tile and any marquee asset need the same treatment.
