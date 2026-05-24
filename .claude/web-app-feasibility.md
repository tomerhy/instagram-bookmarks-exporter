# Web App Idea: Feasibility Analysis

**Date:** May 12, 2026
**Context:** Friend suggested replacing the Chrome extension with a standalone website that logs into Instagram via API and pulls saved albums directly. Goal: reduce install friction (~10 clicks) and unlock viral sharing.

---

## TL;DR

The proposed idea — **a standalone website that replaces the extension** — is **not technically feasible** as described. The friend's suggestion is built on an incorrect assumption about how the current product works.

However, the underlying *intuitions* (lower friction, viral sharing, "Pinterest for Instagram saved posts") are valid — they just need to be implemented differently.

**Recommended path:** Keep the extension as the data pipe + publish to Chrome Web Store (cuts install to 2 clicks) + build a companion web app for the social/sharing layer.

---

## Why the Idea as Proposed Doesn't Work

The friend assumes "use the existing backend." **There is no backend.** All the magic happens inside the user's browser, inside an Instagram tab. There's no cloud service to plug a new website into.

### How the extension actually works

Looking at `injector.js`:

```140:166:injector.js
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

      if (url.includes('/api/') || url.includes('graphql') || url.includes('/media/') ||
          url.includes('/info') || url.includes('/p/') || url.includes('/reel/')) {

        const cloned = response.clone();
        cloned.text().then(text => {
          try {
            const data = JSON.parse(text);
            const media = extractMediaFromData(data);
```

The code wraps Instagram's own `fetch` and reads the responses Instagram's own page already requested. This works **only because**:

1. The code runs **inside `instagram.com`** (via `content_scripts` with `world: MAIN` in the manifest).
2. The browser already has the user's authenticated **session cookies**.
3. **CORS is not an issue** because everything is same-origin.

The moment you move to an external website (`myapp.com`), all three of those conditions disappear at once.

---

## The "Instagram API for Saved Posts" Misconception

This is a common confusion — **there is no Instagram API that exposes saved posts**:

| API | Status | Supports Saved Posts? |
|---|---|---|
| Instagram Basic Display API | **Deprecated December 2024** | No |
| Instagram Graph API (Meta) | Active | **No** — only Business/Creator accounts, only their own content |
| Instagram Login (OAuth) | Active | **No** — no endpoint for saved posts |
| Private API (reverse-engineered) | Exists, violates ToS | Technically yes, practically no |

Meta deliberately does not expose saved posts in any public API. There is zero chance they'd approve an app whose purpose is to export saved posts — it's the opposite of their business model (keeping users inside the app).

---

## Viable Options (Ranked by Realism)

### 1. Publish the extension to Chrome Web Store ← simplest fix for the friction the friend described

The "10 clicks to install" pain is because installation today happens in Developer Mode from an unpacked folder. On the Chrome Web Store, install is **2 clicks**: "Add to Chrome" → "Add extension."

This solves ~80% of the friction the friend complained about, **without rebuilding anything**.

### 2. Companion web app for the social/share layer ← where the friend's idea is gold

The right separation:

- **Extension** = the "data pipe." Keep it minimal, only captures media.
- **Web app** = everything the friend described — public albums, share-with-friends, share galleries, discovery feed, "Pinterest-like" experience.

The user installs the extension **once**, the extension pushes captured media to their account on the web app, and everything beyond that (sharing, public album creation, feed) happens on the website with **zero additional friction**.

This is also what enables the virality the friend imagined: a public album link that anyone can view **without installing anything**. The viewer experience is web-only.

The current `gallery.html` / `gallery.js` is essentially the MVP of this — it just lives locally in the browser today. Move state to Supabase/Firebase, add public album URLs, and you have the website the friend pictured.

### 3. Bookmarklet instead of extension ← middle ground

A JavaScript snippet the user drags to their bookmarks bar. Same `injector.js` logic, no extension. Still has install friction (drag to bookmarks), fewer features, but no Chrome Web Store dependency.

### 4. Server-side scraping with user credentials ← do not recommend

User hands over their password / cookies, your server logs into Instagram on their behalf. Problems:

- **Trust:** Instagram password ≈ Facebook password. Almost no one will hand it over.
- **Terms of Service:** Clear violation of Meta's platform terms.
- **Bans:** High likelihood the user's account gets challenged / suspended because a cloud server IP ≠ their normal IP.
- **Legal:** In some jurisdictions (CFAA in the US, GDPR if you store the content) this is a gray-to-red area.

---

## Recommended Path

Do both, in this order:

1. **First — publish the extension to the Chrome Web Store.** Solves the 10-click pain. One or two days of work. Nothing to rebuild.
2. **Then — build a web app on top of the captured albums.** The "Pinterest-killer" value isn't in the capture (the extension already nails that), it's in the share/discover layer **on top of** captured media.

What is **not feasible** is bypassing the extension entirely. The capture pipe must stay client-side, inside an `instagram.com` tab, because that's where the authenticated session lives. Any other version hits CORS, the lack of a public saved-posts API, or ToS violations with account-ban risk for your users.

---

## Open Questions for Later

- [ ] Does the Chrome Web Store review process accept the current `manifest.json` permissions as-is, or does anything need trimming?
- [ ] Backend choice for the web app: Supabase vs Firebase vs self-hosted?
- [ ] How to handle media storage / hotlinking — Instagram CDN URLs expire, so public albums need re-hosted thumbnails at minimum.
- [ ] Auth model for the web app — email/password, Google OAuth, or "extension generates a pairing code"?
- [ ] Privacy/legal review for hosting other people's saved Instagram media on a public URL (even with the original poster's content visible — DMCA, takedown flow).
