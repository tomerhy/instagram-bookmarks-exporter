# Chrome Web Store Listing

Source of truth for the store listing copy. Edit this file when shipping a
new release, then paste the relevant sections into the Chrome Web Store
Developer Dashboard.

**Last updated for**: v4.4.0 (2026-05-24)

---

## Short description (manifest.json `description` field)

Limit: **132 characters** (Chrome Web Store hard limit). Shown in search
results and the listing card. Make it count.

```
Backup Instagram saved posts. Capture images, videos, carousels — with full metadata, search, and per-album zip download.
```

(127 / 132 chars)

When this changes:
1. Update `manifest.json` → `description` field.
2. Update this section.
3. Both should agree.

---

## Detailed description (Store listing → Detailed description)

Limit: **16,000 characters**. Use markdown-flavored text — Chrome Web
Store ignores most markdown but renders line breaks and bullet symbols.

```text
📸 IG Exporter — Export Your Instagram Saved Posts

Finally, a simple way to back up, browse, and SEARCH all your Instagram
saved posts. IG Exporter captures images, videos, reels, and carousels
— with full metadata, a premium gallery, and built-in search by
caption, @username, or #hashtag.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ KEY FEATURES:

🔍 Search Your Saved Posts
Find anything fast — search by caption text, @owner, or #hashtag.
Filter the gallery live as you type.

🔠 Sort Any Way You Want
Drop-down next to the search box: capture order, newest post,
oldest post, owner A–Z, or most liked.

🎠 Carousel Albums, Expanded
Every slide from every carousel captured automatically. Click an album
in the gallery to see all its slides in a sleek inline drawer — no
fullscreen needed.

🏷️ Full Metadata
Every captured item carries the original owner, caption, date, and
hashtags. So you always know what you're looking at, and search
actually works.

🎬 Videos & Reels
Download videos and reels at full quality. Inline playback with a
slideshow mode (2s / 3s / 5s autoplay) for catching up on your library.

🖼️ Beautiful Gallery
A premium dark gallery with glass surfaces, smooth motion, and a
sticky preview panel. Fullscreen viewer + keyboard navigation built in.

📥 Powerful Export Options
Click any item to download. Three export formats:
  • Export All — full JSON backup with all metadata
  • Export CSV — flat spreadsheet for Excel / Sheets
  • Download Album — single carousel post as a zip
  • Download All — every visible item as a zip, organized by owner

🔔 Smart Notification Badge
The toolbar badge shows only NEW captures since you last opened the
gallery — never a stale total.

🔄 Smart Deduplication
Skips duplicate content automatically, even across Instagram's
signed-URL refreshes.

⚡ Lightning Fast
Optimized capture pipeline — scan hundreds of posts in minutes.

🔒 100% Private
Everything runs locally in YOUR browser. No data is ever sent to
external servers. No account required. No tracking.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 HOW TO USE:

1️⃣ Go to your Instagram saved posts page (instagram.com → Profile → Saved)
2️⃣ Click the IG Exporter icon in your browser toolbar
3️⃣ Click "Capture All" to start scanning your posts
4️⃣ Open "Gallery" to browse, search, sort, and download your media

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 PERFECT FOR:
• Content creators backing up inspiration
• Social media managers saving references for later
• Anyone who wants to keep their favorite posts organized
• Photographers and designers collecting visual references

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆓 Completely FREE — no premium features, no subscriptions, no limits.

Questions or feedback? Click the extension icon, then click the logo
to see contact info — or email tomer.haryoffi@gmail.com.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Note: This extension is not affiliated with Instagram or Meta. Please
respect copyright and only download content you have the right to save.
```

---

## What's New in this version (Store listing → What's new in this version)

This is the changelog shown to existing users when they update. Keep it
short — only the most recent release. Past entries are still useful for
context but compress them.

### v4.4.0 — Consolidation release

```text
v4.4.0 — More export options + cleanup

NEW
• Sort gallery by date, owner, or like count (drop-down next to search)
• Export CSV — flat spreadsheet with full metadata
• Download Album — carousel posts as a single zip with metadata.json
• Download All — every visible item as a zip, organized into per-owner
  folders

UNDER THE HOOD
• ~290 lines of dead code removed (legacy storage keys, redundant
  fetch/XHR hooks, DOM-scan fallback)
• Tests grew from 177 to 251

Recent shipped:
v4.3.10 — Easter egg: click the popup logo for contact info
v4.3.9  — Search by @owner, #tag, or caption
v4.3.8  — Carousel inline drawer (click album badge → see all slides)
v4.3.6  — JSON export/import preserves all metadata
v4.3.5  — Clear in gallery now resets the viewer + confirms
v4.3.2  — Premium dark UI: aurora background, glass surfaces, polished motion
```

---

## Screenshots

Listed at `assets/screenshots/screenshot-{1,2,3}-*.png`. All 1280×800.

| # | File | Description |
|---|---|---|
| 1 | screenshot-1-popup.png | Popup toolbar — "Capture images, videos, and carousels with one click." |
| 2 | screenshot-2-gallery.png | Gallery grid — "Search by @owner, #tag, or caption. Preview every slide." |
| 3 | screenshot-3-videos.png | Videos tab — "Inline playback with owner, caption, and date for every clip." |

To regenerate after UI changes:
1. Capture fresh screenshots into `assets/screenshots/raw/` per
   `assets/screenshots/raw/README.md`.
2. Run `python3 compose_screenshots.py`.
3. Upload the resulting `screenshot-*.png` files via the store dashboard.

---

## Category / tags (Store listing → Category)

- **Category**: Productivity
- **Tags / search keywords**: instagram, saved posts, download, exporter,
  backup, media, carousel, reels, gallery, archive

---

## Pre-submission checklist

Before clicking "Submit for review" on a new version:

- [ ] `manifest.json` version bumped (X.Y.Z, integers only — Chrome
      rejects any non-numeric suffix)
- [ ] Short description in `manifest.json` matches the **Short
      description** section above
- [ ] Built zip is fresh: `./build.sh` produces
      `instagram-saved-media-exporter.zip` and it loads cleanly via
      "Load unpacked" before upload
- [ ] All 251+ unit tests pass: `npm test`
- [ ] Manual QA pass on a real Instagram account — at minimum:
      capture, search, sort, export-all, export-csv, download-album,
      download-all, gallery clear
- [ ] Detailed description above updated to reflect any new user-visible
      features
- [ ] "What's new in this version" section above updated with the latest
      changes
- [ ] Screenshots regenerated if any UI moved significantly
- [ ] Tag the release commit: `git tag -a vX.Y.Z -m "vX.Y.Z release"`
      and `git push origin vX.Y.Z`

---

## Notes on past versions

- **v4.4.0** (2026-05-24): Cleanup + sort + CSV + per-album zip +
  per-owner library zip. Tests: 230 → 251.
- **v4.3.10** (2026-05-23): Easter egg about-the-maker card on the
  popup logo. First version live on the store.
- **v4.3.0** (2026-04-29): Album mode + metadata pipeline. The
  groundwork release that unlocked everything above.
- **v4.2.x and earlier**: Pre-metadata. Items had only `{type, url,
  thumbnail, postUrl}`.
