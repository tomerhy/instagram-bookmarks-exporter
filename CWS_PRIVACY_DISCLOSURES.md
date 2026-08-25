# Chrome Web Store — Privacy practices tab

Recommended answers for the **Privacy practices** tab of the developer
dashboard, for **Saved Posts Backup & Export v4.4.1**.

**These are not submitted automatically.** Copy them into the dashboard
manually after reviewing them. Nothing in this repository publishes, submits,
or appeals anything.

Every answer below is backed by a test in `tests/compliance.test.js` or
`tests/capture-gate.test.js`, so if the code drifts the claim fails in CI
rather than in review.

---

## 1. Single purpose description

Paste into **Single purpose**:

> This extension has one purpose: to let a signed-in user save a local backup
> copy of their own saved posts. When the user explicitly starts a capture, it
> reads the saved-post data the browser has already received for the page they
> are viewing, stores it locally, and provides a gallery to browse, search, and
> download that library as files, ZIP archives, JSON, or CSV. It does nothing
> else.

---

## 2. Permission justifications

Paste one per field. Keep them this short — reviewers read them literally.

### `storage`

> Stores the user's captured library and their preferences locally via
> `chrome.storage.local`. This is the extension's only data store; it is where
> the backup lives so the gallery can display it after the tab is closed.

### `unlimitedStorage`

> Raises Chrome's default local-storage quota. A saved collection with captions
> and album metadata can exceed the default limit, and without this permission
> a capture fails partway and the user loses the backup they were making. This
> permission grants no access to any data — it only raises a size limit.

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
| Personally identifiable information | **No** | No name, address, email, age, or ID number is read or stored. |
| Health information | No | — |
| Financial and payment information | No | — |
| Authentication information | **No** | No password, credential, security question, or PIN is ever requested, read, or stored. See §5. |
| Personal communications | **No** | Emails, texts, and chat messages are not accessed. Post captions are public post content, not private communications, and never leave the device. |
| Location | No | — |
| Web history | **No** | No list of visited pages is compiled or stored. The extension has access to one site and stores only the specific posts the user chose to back up. |
| User activity | **No** | No clicks, mouse position, keystroke, or network-monitoring data is collected. Versions ≤ 4.4.0 did send button-click analytics; that was removed in 4.4.1. |
| Website content | **Yes** | Media URLs, post URLs, usernames, captions, timestamps, like counts, hashtags, and album metadata from the user's own saved posts — read only after the user starts a capture, and stored only on their device. |

### If the dashboard asks you to elaborate on "Website content"

> After the user presses Start capture, the extension reads the saved-post
> content already delivered to their browser for the page they are viewing:
> media URLs, post URLs and shortcodes, usernames, captions, timestamps, like
> counts, hashtags, and album/carousel metadata. This is stored locally in
> `chrome.storage.local` so the user can browse and download their backup. It
> is never transmitted off the device.

---

## 4. Required certifications

All three must be checked, and all three are true:

- [x] **I do not sell or transfer user data to third parties, outside of the
      approved use cases.**
      No data leaves the device at all, so there is nothing to transfer.
- [x] **I do not use or transfer user data for purposes that are unrelated to
      my item's single purpose.**
      The captured data is used only to render and export the user's own backup.
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
