# Chrome Web Store — Privacy practices tab

Recommended answers for the **Privacy practices** tab of the developer
dashboard, for **Saved Posts Library & Export v4.4.3**.

**These are not submitted automatically.** Copy them into the dashboard
manually after reviewing them. Nothing in this repository publishes, submits,
or appeals anything.

Every answer below is backed by a test in `tests/compliance.test.js` or
`tests/capture-gate.test.js`, so if the code drifts the claim fails in CI
rather than in review.

---

## 1. Single purpose description

Paste into **Single purpose**:

> This extension has one purpose: to help a signed-in user keep a local library
> of the posts they have saved, and download media from them on request. When
> the user explicitly starts a capture, it reads the saved-post data the browser
> has already received for the page they are viewing and stores the links and
> details locally. The gallery then lets the user browse and search that
> library, and download selected media as files, ZIP archives, JSON, or CSV. It
> does nothing else.

---

## 2. Permission justifications

Paste one per field. Keep them this short — reviewers read them literally.

### `storage`

> Stores the user's captured library and their preferences locally via
> `chrome.storage.local`. This is the extension's only data store; it is where
> the library of links and post details lives so the gallery can display it
> after the tab is closed.

### `unlimitedStorage`

> Raises Chrome's default local-storage quota. A library of several thousand
> records carrying captions and album metadata can exceed the default limit, and
> without this permission a capture fails partway and the user loses what they
> were collecting. This permission grants no access to any data — it only raises
> a size limit.

### Host permission: `https://www.instagram.com/*`, `https://instagram.com/*`

> The extension only works on the saved-posts pages of this one site. Host
> access is needed so the content scripts can run there, and so the popup can
> tell whether the active tab is that site (to show either the capture controls
> or a "open your saved posts first" message). No other site is requested.

### Remote code

> **No, I am not using remote code.** All JavaScript is contained in the
> uploaded package. The only third-party library (JSZip 3.10.1) is bundled in
> `lib/jszip.min.js`. There are no CDN scripts, no `eval`, no `new Function`,
> and no dynamic `import()`.

---

## 3. Data usage disclosures

Check **only** these categories:

| Category | Collected? | Notes for the "why" field |
|---|---|---|
| Personally identifiable information | **Yes** | Corrected in 4.4.2 — see §3a below. Instagram usernames / account identifiers are processed and stored locally. They usually identify the *post owner* rather than the extension's user, and they never leave the device, but a username is an account identifier and answering "No" would be wrong. |
| Health information | No | — |
| Financial and payment information | No | — |
| Authentication information | **No** | No password, credential, security question, or PIN is ever requested, read, or stored. See §5. This answer stays No and is defensible. |
| Personal communications | **No** | Emails, texts, and chat messages are not accessed. Post captions are post content, not private correspondence, and are not transmitted anywhere. |
| Location | No | — |
| Web history | **No** | No list of visited pages is compiled or stored. The extension has access to one site and stores only the specific posts the user chose to keep. |
| User activity | **Yes** | Corrected in 4.4.3 — see §3b. The extension stores a small amount of local interaction state: when you accepted the first-run disclosure, and when you last looked at your library. Chrome requires disclosure even for data handled entirely locally. No keystrokes, mouse positions, or network monitoring, and nothing is transmitted. |
| Website content | **Yes** | Media URLs, post URLs, usernames, captions, timestamps, like counts, hashtags, and album metadata from the posts the user has saved — read only after the user starts a capture, and stored only on their device. |

### 3a. Why "Personally identifiable information" is Yes

This was answered **No** in the 4.4.1 draft. That was wrong, and worth
correcting explicitly rather than quietly.

The extension stores Instagram usernames (`metadata.owner`) and post
shortcodes. A username is an account identifier, and it identifies a person —
normally the author of a saved post rather than the extension's own user.
Reasoning that "it is not the user's own PII, therefore not PII" is the kind of
argument a reviewer is right to reject.

Paste into the "why" field:

> The extension stores the username of the account that published each saved
> post, together with the post link, caption, date, like count and hashtags.
> Usernames are used only locally: to group the library by author, to power the
> `@username` search filter, and to name folders inside a ZIP export. They are
> never transmitted to the developer, to analytics services, to advertising
> services, or to any third party. They are deleted with the rest of the
> library when the user chooses "Clear all data", and they are removed entirely
> when the extension is uninstalled.

### 3b. Why "User activity" is Yes

Answered **No** through 4.4.2. That was wrong twice over.

First, the code was worse than the answer: the popup incremented a `useCount`
key on **every open**, and used it to trigger a donation banner on the 15th.
Counting how often a user opens a UI, in order to act on the count, is user-
activity tracking however locally it is stored. **4.4.3 removes that feature
entirely** — the counter, the threshold, the banner, and the
`supportDismissed` flag — and `legacy-cleanup.js` deletes both keys from
existing installs. A static support link that does nothing until clicked, and
stores nothing, is all that remains.

Second, even after that removal the answer is still Yes, because two
interaction timestamps remain and both are load-bearing:

| Key | Written when | Why it cannot simply be dropped |
|---|---|---|
| `sbeConsentAcceptedAt` | you accept the first-run disclosure | It *is* the consent gate. `content.js` refuses to start a capture without it. Removing it would mean either re-prompting on every capture or not enforcing consent at all. |
| `igExporterLastSeenAt` | you open the popup or the library | Drives the "new since you last looked" toolbar badge. Without it the badge cannot exist. |

Chrome's guidance asks whether the category is *handled*, not whether it is
transmitted. Both are records of user interaction, so the honest answer is Yes
with a narrow explanation, rather than No with a footnote.

Paste into the "why" field:

> The extension stores local interaction state only: a timestamp recording that
> you accepted the first-run disclosure, and a timestamp of when you last
> viewed your library. The first is what enforces the consent requirement — a
> capture cannot start without it. The second powers the "new items since you
> last looked" badge on the toolbar icon. Neither is transmitted anywhere, and
> neither is used for analytics, advertising, profiling, or any form of
> measurement. Version 4.4.3 removed the only other interaction data the
> extension had ever stored — a counter of how many times the popup was opened,
> which triggered a donation prompt — and deletes it from existing installations.

### If the dashboard asks you to elaborate on "Website content"

> After the user presses Start capture, the extension reads the saved-post
> content already delivered to their browser for the page they are viewing:
> media URLs, post URLs and shortcodes, usernames, captions, timestamps, like
> counts, hashtags, and album/carousel metadata. This is stored locally in
> `chrome.storage.local` so the user can browse it and choose what to download.
>
> The extension does not transmit the captured library to the developer,
> analytics services, advertising services or unrelated third parties. When the
> gallery displays or downloads media, the browser requests the corresponding
> allowlisted media URL from Instagram/Meta's CDN.

---

## 4. Required certifications

All three must be checked, and all three are true:

- [x] **I do not sell or transfer user data to third parties, outside of the
      approved use cases.**
      The captured library is not transferred to anyone. The only outbound
      requests are the browser fetching media from Instagram/Meta's own CDN when
      the user views or downloads it — that is the user's data going back to the
      service it came from, not a transfer to a third party.
- [x] **I do not use or transfer user data for purposes that are unrelated to
      my item's single purpose.**
      The captured data is used only to render the local library and to produce
      the exports and downloads the user asks for.
- [x] **I do not use or transfer user data to determine creditworthiness or for
      lending purposes.**

---

## 5. Authentication information — answer "No", and why that is defensible

This is the question the phishing allegation turns on, so the supporting facts
are stated explicitly rather than asserted.

- The extension contains **no `<form>` element and no password input** on any
  page. Asserted by `tests/compliance.test.js` → *"there is no login form or
  password field in any page"*.
- It requests **no `cookies` permission** and never reads `document.cookie`.
- It never reads an `Authorization` header, a CSRF token, a session ID, or a
  two-factor code. Static scans for all of these are in
  `tests/compliance.test.js` → *"no shipped code reads cookies, tokens,
  passwords or auth headers"*.
- It has **no `webRequest` / `declarativeNetRequest` permission**, so it cannot
  inspect or modify request headers.
- It does not display, imitate, or overlay an Instagram login screen. The only
  UI it injects into the page is nothing at all — as of 4.4.1 the in-page panel
  is gone and all controls live in the extension popup.
- The two text inputs in the whole extension are a gallery search box and an
  Import file picker. Asserted by *"the only inputs anywhere are the search box
  and the import file picker"*.
- The extension relies on the browser's existing signed-in session **only**
  implicitly: it reads responses the page already received. It never touches
  the credentials behind that session.

---

## 5a. Wording to avoid — and why

**Do not write "nothing is transmitted" as an absolute.** It is not true, and a
reviewer who opens the Network tab will see it is not true. Opening the library
loads thumbnails from the CDN; downloads and ZIP actions fetch media from the
CDN. Both are the browser requesting Instagram's own content on the user's
behalf, but both are network traffic.

The accurate formulation, used throughout this document and in
`privacy-policy.html`:

> The extension does not transmit the captured library to the developer,
> analytics services, advertising services or unrelated third parties. When the
> gallery displays or downloads media, the browser requests the corresponding
> allowlisted media URL from Instagram/Meta's CDN.

Two more phrases to avoid, corrected in 4.4.2 for the same reason:

- ~~"Downloading your own media"~~ → "Displaying or downloading media from posts
  you saved." The media is not the user's; saving it is the user's act.
- ~~"The extension does not access other users' private posts"~~ → "The
  extension does not access content that the signed-in user is not authorized to
  view." A post saved from a private account the user follows *is* processed,
  and pretending otherwise is a claim that fails the first time a reviewer tries
  it.

---

## 6. Privacy policy URL

Host `privacy-policy.html` at a stable public URL and enter it in the
dashboard. The packaged copy ships inside the extension and is linked from both
the popup About dialog and the gallery header.

---

## 7. Disclosures that must be made, not hidden

Include the following in the submission notes or the release notes. It is
better for this to come from the developer than to be discovered by a reviewer:

> Versions up to and including 4.4.0 contained a Google Analytics 4
> Measurement Protocol client that sent usage events (page views, button
> clicks, feature names, error names) and a randomly generated persistent
> client identifier to Google. The privacy policy of those versions incorrectly
> stated that no analytics was used. Version 4.4.1 removes the analytics code,
> its measurement ID and API secret, all of its call sites, and the
> `google-analytics.com` host permission, and deletes the leftover identifiers
> from the user's browser on first run. No Instagram content, media URL,
> caption, or username was ever included in those analytics events.

Also disclose the permission change, since it is a reduction:

> 4.4.1 removes the `activeTab` permission and the `google-analytics.com` host
> permission, and removes an unrelated video-autoplay feature that was outside
> the extension's single purpose.

Disclose the 4.4.2 security fix too, since it changed how stored data is
handled:

> 4.4.2 fixes a defect found in an independent review of 4.4.1: records saved by
> version 4.4.0 or earlier were loaded from local storage without being
> validated, because validation had only been applied to newly captured and
> newly imported data. A crafted record already present in storage could
> therefore reach the gallery's rendering and download paths. 4.4.2 sanitises
> the library whenever it enters the process, re-validates every URL at the
> point of use, rewrites the cleaned library back to storage so unsafe values
> are removed permanently, and adds a Content Security Policy to the extension's
> pages. No user data was transmitted anywhere as a result of the defect; it was
> a local rendering-safety issue.
