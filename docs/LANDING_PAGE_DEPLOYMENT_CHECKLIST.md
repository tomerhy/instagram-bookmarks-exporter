# Landing page — deployment checklist (v4.4.3)

> ## ⚠ Still not deployed — and the mechanism is now known exactly
>
> `index.html` is remediated **in this repository only**, on the release branch.
> Nothing has been published. What changed on 2026-08-26 is that the hosting
> setup was read from the GitHub API instead of inferred, so this is no longer
> guesswork — see §1.
>
> **GitHub Pages serves `main` at the repository root.** The release work is on
> `v4.4.1-cws-remediation`. Therefore the remediated page is *not* live and will
> not become live until `index.html` reaches `main`.
>
> The live page was checked by reading `origin/main:index.html` — no external
> request needed. It still contains **18 testimonial references, one named
> fabricated reviewer, three star glyphs, an install/user count, an "Add to
> Chrome" call to action for an extension that is not listed, a stale
> `og:image`, and four "Export Instagram…" headlines.**
>
> This is the single highest-value outstanding action after the extension
> package itself. The page is public, indexed, and directly contradicts what the
> appeal will claim. It was deliberately **not** published by the compliance
> work: pushing to `main` publishes public content, which is a decision for the
> repository owner to make and to time against the appeal.

---

## 1. The deployed URL

Read from the GitHub API on 2026-08-26
(`gh api repos/tomerhy/saved-posts-library-export/pages`), not inferred:

| | |
|---|---|
| Live URL | `https://tomerhy.github.io/saved-posts-library-export/` |
| Hosting | GitHub Pages, `build_type: legacy` |
| Source | **branch `main`, path `/`** |
| Status | `built` |
| HTTPS enforced | yes |
| Custom domain | none (`cname: null`) |
| Public | yes |

**So deployment means: get the remediated files onto `main`.** There is no
CI workflow, no `gh-pages` branch, no Netlify/Vercel config, and no `CNAME` —
Pages rebuilds by itself when `main` changes. Nothing else to configure.

The page-relevant files that differ between `origin/main` and the v4.4.3 release
commit:

```
index.html
privacy-policy.html
manifest.json
assets/icons/icon-{16,32,48,128}.png
assets/icons/icon-source.png
assets/icons/portrait-source.png
```

`index.html` references `assets/icons/icon-128.png` for the nav and footer
logos, so the icons must land on `main` in the same change or the deployed page
will show the old artwork — or a broken image.

**The repository rename is done.** This paragraph used to argue for it as a
judgement call; it was carried out on 2026-08-31 —
`instagram-bookmarks-exporter` → `saved-posts-library-export` — so the public
URL no longer contains the mark. See `COMPLIANCE_EVIDENCE.md` §20.6.

The cost was real and was accepted: **the old Pages URL now returns HTTP 404.**
GitHub redirects a renamed repository's repo URLs but not a project site's Pages
address, so every inbound link to
`tomerhy.github.io/instagram-bookmarks-exporter/` is dead. If a redirect ever
matters, the only mechanism is a separate repository at the old name serving a
meta-refresh page — which would reintroduce the mark into a URL, and is
therefore probably not worth it.

---

## 2. What was changed in `index.html`

Already done in the working tree — verify each is present in what you deploy.

| Item | Before | After |
|---|---|---|
| `<title>` | `IG Exporter - Export Instagram Saved Posts & Media \| Chrome Extension` | `Saved Posts Library & Export \| Chrome Extension` |
| `meta description` | "Export and download your Instagram saved posts…" | Factual description + "Independent third-party extension, not affiliated with Instagram or Meta." |
| `og:title` / `twitter:title` | `IG Exporter - Export Instagram Saved Posts…` | `Saved Posts Library & Export` |
| `og:description` / `twitter:description` | promotional, no disclaimer | factual, disclaimer included |
| `--primary` | `#E1306C` (Instagram pink) | `#0F8B8D` (teal) |
| `--primary-dark` | `#c13584` | `#0B6E70` |
| `--gradient` | `linear-gradient(135deg, #833ab4, #E1306C, #fd1d1d)` — Instagram's gradient | `linear-gradient(135deg, #0B6E70, #0F8B8D)` |
| `<h1>` | "Export Your **Instagram Saved Posts** in Seconds" | "Back Up Your **Saved Posts** to Your Own Computer" (4.4.1) |
| Section heading | "Everything You Need to Export Instagram Media" | "What It Does" |
| CTA copy | "Stop losing your favorite Instagram content." | "Keep your own copy of the posts you saved." |
| Product name in nav/footer/steps | "IG Exporter" (×4) | "Saved Posts Library" / neutral phrasing (renamed again in 4.4.2) |
| Screenshot `alt` | "IG Exporter Gallery View - Browse and download your saved Instagram media" | "The extension's Library page, showing captured posts" |
| Testimonials section | 3 fabricated reviews (see §4) | **Removed**, with an HTML comment recording why |
| Non-affiliation disclaimer | absent | added above the footer |

---

## 2a. Additional corrections made in 4.4.2

| Item | Before | After |
|---|---|---|
| Feedback form | A Formspree form (`formspree.io/f/mdalorok`) collecting an email address and a free-text message via a third party | **Removed.** Replaced with a plain link to the repository's GitHub Issues page. A form is a data-collection surface the privacy policy did not cover and the project does not need. |
| Footer "Contact" link | Pointed at the same Formspree endpoint | Now "Report an issue" → GitHub Issues |
| Testimonial CSS | `.testimonials`, `.testimonial*`, `.author-*` rules left behind after the block was deleted | Removed, along with the explanatory "fabricated reviews" comment. Nothing remains to hint the section ever existed. |
| "Capture hundreds of posts in minutes, not hours" | Unsupported performance claim | "Capture runs while the page scrolls, so a large collection is recorded without you clicking through every post." |
| "Takes less than 5 seconds" | Unsupported install-time claim | "Add the extension to Chrome, then open your saved posts." |
| ~~No data is ever sent to external servers~~ | False — previews and downloads fetch from the CDN | States that the library stays local, and that previews/downloads fetch media from Instagram's CDN |
| "Get It Free on GitHub" | Reads as an invitation to sideload instead of installing a reviewed extension | "View Source on GitHub", framed as *read the code before trusting it* |
| `og:image` | Referenced `assets/og-image.png`, **a file that does not exist** | Tag removed entirely. See §5 before adding one back. |
| Capture vs download | Conflated | The "How it works" header now states the two-step reality explicitly: capture records links and details; download saves files; captured links can expire |
| Product name | "Saved Posts Backup" | "Saved Posts Library" |

### Verify these are gone from the deployed page

```bash
URL=https://tomerhy.github.io/saved-posts-library-export/
curl -s "$URL" > live.html

# All must return nothing:
grep -o 'formspree'                     live.html
grep -o 'testimonial'                   live.html
grep -o 'og-image'                      live.html
grep -o 'hundreds of posts'             live.html
grep -o 'less than 5 seconds'           live.html
grep -o 'Get It Free'                   live.html
grep -o '<form'                         live.html
grep -o 'never sent to external'        live.html

# Must return a match:
grep -o 'View Source on GitHub'         live.html
grep -o 'Saved Posts Library'           live.html
grep -o 'github.com/[^"]*/issues'       live.html
```

---

## 3. Old branding that must not survive

Check the **deployed** page, not just the repository. Run these against the live
HTML once it is up.

```bash
URL=https://tomerhy.github.io/saved-posts-library-export/
curl -s "$URL" > live.html

# Must all return nothing:
grep -o 'IG Exporter'                                    live.html
grep -oiE '#(E1306C|833AB4|C13584|FD1D1D|FCB045|405DE6)' live.html
grep -oiE 'rgba?\(\s*(225, *48, *108|131, *58, *180)'    live.html
grep -o 'Loved by Instagram Users'                       live.html
grep -o 'testimonial'                                    live.html
grep -o 'Sarah M\.\|Jake T\.\|Maria L\.'                 live.html

# Must return a match:
grep -o 'Saved Posts Library'                            live.html
tr -s '[:space:]' ' ' < live.html | grep -o 'Not affiliated with, authorized by, endorsed by, or sponsored by Instagram or Meta'
```

Beyond text, check by eye:

- [ ] No Instagram logo, wordmark, camera glyph, or badge anywhere.
- [ ] No pink/orange/purple gradient in any element, including buttons and hero.
- [ ] No favicon still carrying the old icon (browsers cache these aggressively
      — hard-reload, and check `assets/icons/` is republished too).
- [ ] No `og:image` tag is present, OR it points at a newly generated neutral
      image. **`assets/og-image.png` never existed** — the tag referenced a
      missing file, and 4.4.2 removed the tag rather than inventing artwork.
      If you add one back, it is bound by `SCREENSHOT_PLAN.md`.
- [ ] The embedded screenshot (`assets/screenshots/screenshot-2-gallery.png`)
      is replaced. The current file shows the old pink/purple gallery **and
      real third-party Instagram data** — at least three identifiable usernames
      and photographs of identifiable people. It must not be republished. See
      `SCREENSHOT_PLAN.md`.
- [ ] No "official", "approved", "endorsed", "partner", or "best" language.

---

## 4. Fabricated testimonials — removed

The page published three reviews as genuine, with named authors, job titles and
five-star ratings, under "Loved by Instagram Users" and "Join thousands who've
saved their favorite content":

- "Sarah M.", Content Creator
- "Jake T.", Photographer — praised "the selection feature"
- "Maria L.", Social Media Manager

**Why this had to go:** the "selection feature" Jake T. praises was
*unreachable dead code in every shipped version* — no UI ever exposed it. A
real user could not have used it, so the quote cannot be real feedback.
Publishing invented reviews is a deceptive-practices problem in its own right,
separate from the trademark issue, and it would undermine any appeal arguing
good faith.

- [ ] Section is absent from the deployed page.
- [ ] "Join thousands who've saved their favorite content" is gone (an unfounded
      user-count claim).
- [ ] No other unverifiable social-proof or install-count claim remains anywhere
      on the page.
- [ ] If any quote **is** genuine, restore it with real, verifiable attribution
      and the reviewer's permission — not a first-name-and-initial.

---

## 5. Disclaimer, policy link, name and icon

- [ ] The non-affiliation disclaimer appears on the deployed page, in this exact
      wording, visible without interaction:
      > Independent third-party extension. Not affiliated with, authorized by,
      > endorsed by, or sponsored by Instagram or Meta.
- [ ] The privacy-policy link **resolves on the deployed page**. `index.html`
      links to `privacy-policy.html` as a *relative* path, so it only works if
      `privacy-policy.html` is deployed alongside it in the same directory.
      **Verify by clicking it on the live site, not locally.**
      ```bash
      curl -sI "$URL"privacy-policy.html | head -1   # expect 200, not 404
      ```
      Enter that same public URL in the Chrome Web Store dashboard. The landing
      page, the store listing and the in-extension copy must all point at the
      same document.
- [ ] Product name reads **Saved Posts Backup & Export** consistently, matching
      `manifest.json` exactly.
- [ ] Any icon shown on the page is the new teal/slate archive icon, not the old
      photo-on-magenta one. Regenerate with `python3 tools/make-icons.py` if the
      page embeds its own copy.
- [ ] Chrome Web Store links: the old item was removed, so any "Add to Chrome"
      link is dead. Either remove it or point it at the new listing once live —
      do not leave a link to a removed item.

---

## 6. Pre-deployment verification (repository side)

Run before touching the host. These match the current working tree.

```bash
grep -c 'IG Exporter' index.html                          # expect 0
grep -c 'testimonial' index.html                          # expect 0
grep -c 'formspree'   index.html                          # expect 0
grep -c 'og-image'    index.html                          # expect 0
grep -c '<form'       index.html                          # expect 0
grep -oiE '#(E1306C|833AB4|C13584|FD1D1D)' index.html     # expect no output
# The disclaimer is line-wrapped in the HTML, so a plain grep misses it.
# Normalise whitespace first:
tr -s '[:space:]' ' ' < index.html | grep -c 'Not affiliated with, authorized by, endorsed by, or sponsored by Instagram or Meta'   # expect 1
grep -c 'View Source on GitHub' index.html                # expect 1
grep -c 'Saved Posts Library' index.html                  # expect >= 1
```

- [ ] All nine checks give the expected result.
- [ ] `index.html` opens locally with no console errors and no broken images.
- [ ] Every asset the page references exists and is the updated version.
- [ ] The page states the capture-vs-download distinction, so a visitor is not
      led to believe capture alone produces an offline media backup.

---

## 7. Post-deployment verification (live page)

- [ ] Page loads over HTTPS with no mixed-content warnings.
- [ ] Every `curl`/`grep` check in §3 gives the expected result **against the
      live URL**.
- [ ] Hard-reload in a fresh browser profile — no cached old branding, favicon
      included.
- [ ] Re-render the OG card (e.g. paste the URL into a chat client) and confirm
      the preview shows neutral branding, not the old image.
- [ ] The privacy-policy link resolves.
- [ ] Search engines: the old title may persist in results for a while. Request
      re-indexing if the host supports it, and expect a lag. **Note this lag in
      any correspondence** — a reviewer searching the name may still see a
      cached old title, and it is better to have flagged it than to look as
      though nothing changed.
- [ ] Archived copies (e.g. the Wayback Machine) will still hold the old page.
      Nothing can be done about that; be ready to acknowledge it rather than
      claim the branding never existed.

---

## 8. Order of operations

Deployment interacts with the appeal, so sequence matters:

1. ~~Recapture screenshots~~ — **done.** Six compliant frames are in
   `assets/store-screenshots/`; see `SCREENSHOT_PLAN.md`. The OG image was
   removed rather than regenerated, because the tag pointed at a file that never
   existed. Add one only if it is actually wanted.
2. `privacy-policy.html` is already in the repository root, so it deploys with
   the page and the existing in-page link resolves. Nothing extra to host.
3. **Deploy: put the remediated files on `main`.** Then run §7 against the live
   URL. Two ways, both ordinary:

   ```bash
   # merge the release branch (brings the whole v4.4.3 release with it)
   git checkout main && git merge --no-ff v4.4.1-cws-remediation && git push origin main
   ```

   ```bash
   # or take only the page-facing files, if main should not receive the release yet
   git checkout main
   git checkout v4.4.1-cws-remediation -- index.html privacy-policy.html assets/icons
   git commit -m "landing page: publish the v4.4.3 remediated page" && git push origin main
   ```

   The second form is the safer one if the appeal timing matters: it fixes the
   public page without moving the extension release onto `main`.
4. Only then contact the store or respond to the report — so that anyone who
   follows a link finds the remediated page, not the old one.

Doing step 4 first invites a reviewer to load a page that still says
"IG Exporter" in Instagram's own gradient, with three invented reviews on it.
