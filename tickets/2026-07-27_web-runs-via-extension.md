Priority: 7
Topics: [enhancement, the-framework]
GitHub: [#1328](https://github.com/gemstack-land/the-framework/issues/1328)

# Web runs: drive claude.ai sessions through the browser extension instead of claude --cloud

## TLDR

Maintainer direction (2026-07-28): invest in the extension, not `--cloud`. `--cloud` is a removable CLI flag and is currently broken outright on at least one account (#1320: every session bundles, can never push), while sessions created through the claude.ai UI **with the repo picker** are repo-bound and CAN push and open PRs. The extension already operates on claude.ai pages (v0.7.1: mirrors transcripts, delivers bridge answers); extending it to *create* sessions rides the working path end to end. Sketch: daemon queues a session request on the bridge (repo, branch, prompt) → extension opens a pinned claude.ai/code tab, drives the new-session flow, reports the session URL back → CloudDriver gains an extension-backed mode; `--cloud` stays as the no-extension fallback.

## Why it matters

This is the chosen path to reliable web-run delivery, and the substrate for #1327's 10-agent goal and #1332's headless spike.

## Open questions (from the issue)

1. **The #610 decision reversed:** `driver/cloud.ts` explicitly ruled out driving the claude.ai UI on Usage Policy grounds when `--cloud` was chosen. Adopting this is a conscious reversal; the policy angle should be re-read deliberately (the extension is user-installed, acts inside the user's own logged-in browser, automates exactly the user's own clicks) and the decision put on the record.
2. **UI-selector fragility:** the v0.7 lessons apply (composer render races, tab revival, claude.ai DOM changes). The bridge's report-status plumbing gives observability `--cloud` never had.
3. **Concurrency:** 10 parallel sessions = 10 tabs the extension owns; needs a spike before #1327 rides on this.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1328](https://github.com/gemstack-land/the-framework/issues/1328), created 2026-07-27, labels: `enhancement`, `priority: high`, `the-framework ♻️`, 0 comments. Refs: #1320 (why --cloud is a dead end today), #1327, #1237/#1225 (existing extension bridge).
