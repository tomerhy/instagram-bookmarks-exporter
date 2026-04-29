---
description: Walk through the issues found in the most recent review and fix them one at a time, pausing for user review before each commit.
---

You are fixing issues that were just identified (typically by `/pr-review` or a similar review). Work through them **one at a time** with explicit user checkpoints — do not batch fixes.

## Scope

- Address only items labeled "Issue" by default. Skip "Suggestion" and "Nit" items unless the user explicitly says to include them.
- If the user supplies arguments (e.g. file names or issue keywords), fix only those.
- If no prior review is visible in the conversation, ask the user which issues to fix before doing anything.

## Loop (repeat for each issue)

1. **Announce** the next issue in one or two sentences: which file, which line/area, and what you're about to change. Do not start editing yet.
2. **Apply the fix** using `Edit`/`Write`. Keep the change minimal and scoped to that one issue — no opportunistic refactors, no unrelated cleanup.
3. **Show the diff** for just this fix (`git diff -- <file>` for the touched files) so the user can review it inline.
4. **Stop and wait** for the user to approve, request changes, or skip. Do **not** stage, commit, or move to the next issue until they respond.
5. On approval:
   - Stage only the files touched by this fix (`git add <specific files>`, never `git add -A`).
   - Create a focused commit referencing the issue. Use the project's commit style (see `git log`).
   - Then announce the next issue and repeat.
6. On "skip": move to the next issue without committing.
7. On "change it": revise per their feedback and re-show the diff. Do not commit until they approve.

## Rules

- **One issue per commit.** Never bundle multiple unrelated fixes into a single commit, even if they touch the same file.
- **Never commit without explicit approval** for that specific fix. "Approved" earlier in the session does not roll forward to later fixes.
- **Do not push.** This command only commits locally.
- **Respect project conventions** from `CLAUDE.md` (e.g. version bumps, `build.sh` updates, `normalizeUrl` invariants). If a fix would violate one, flag it before applying.
- **Manual verification reminders**: for content-script or UI changes, remind the user to reload the extension and the Instagram tab before approving — "it edits cleanly" is not evidence the fix works.
- When all selected issues are processed, summarize what was fixed, what was skipped, and what (if anything) remains.
