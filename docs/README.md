# docs/

Compliance and submission material for the Chrome Web Store remediation
(case 79-1827699). These were at the repository root until they outnumbered the
code; nothing about them changed in the move.

The extension's own `README.md` stays at the root, because GitHub renders that
one on the repository home page.

| File | What it is |
|---|---|
| [COMPLIANCE_EVIDENCE.md](COMPLIANCE_EVIDENCE.md) | The audit. §0 states exactly what was and was not verified — read that first. Everything else here defers to it. |
| [CWS_STORE_LISTING.md](CWS_STORE_LISTING.md) | Store listing copy, with the reasoning behind each claim, and which screenshots to upload. |
| [CWS_PRIVACY_DISCLOSURES.md](CWS_PRIVACY_DISCLOSURES.md) | The answers to fill into the Web Store privacy dashboard, and why each one is answered that way. |
| [MANUAL_CHROME_TEST_PLAN.md](MANUAL_CHROME_TEST_PLAN.md) | What the automated suite structurally cannot check. Ends with the recorded result of the 2026-08-26 run. |
| [SCREENSHOT_PLAN.md](SCREENSHOT_PLAN.md) | How the six store screenshots were produced, and the rules every frame is held to. |
| [LANDING_PAGE_DEPLOYMENT_CHECKLIST.md](LANDING_PAGE_DEPLOYMENT_CHECKLIST.md) | The public page: hosting facts, what to verify after publishing. |
| [STORE_LISTING.md](STORE_LISTING.md) | Superseded pointer, kept so old links resolve. Points at `CWS_STORE_LISTING.md`. |

Paths inside these files are relative to this folder, so a bare
`COMPLIANCE_EVIDENCE.md` in the prose still resolves. References to code
(`build.sh`, `manifest.json`, `tests/…`) are relative to the repository root,
one level up.
