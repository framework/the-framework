The single `gh` CLI adapter: PR reads and history, auto-merge arming, CI status rollup, repo capability probes, and token resolution — consolidating what used to be four hand-rolled adapters.

## Decisions

- PRs for a branch use the list form, not `gh pr view` — view answers only the newest PR for a head *in any state*, and the PR-resolution rule needs the whole history to decide.
- Auto-merge fallback semantics: GitHub's "auto-merge unavailable" refusals are matched loosely, so a rephrase degrades to a *reported failure*, never a wrong merge. When auto-merge can't arm: a human's "land it" merges now; the automated path **watches** instead — the direct fallback used to land armed PRs seconds after opening, before their first check ran.
- CI rollup matches GitHub's own merge box: skipped/neutral pass, cancelled/timed-out fail — and **no checks does not merge**, because a check suite takes seconds to attach and a just-opened PR reads as check-less exactly then.

## Facts

- The repo auto-merge capability probe uses the REST endpoint — no `gh repo view --json` field for it exists, so that spelling always errored into "could not say".
- Token resolution prefers `GH_TOKEN`/`GITHUB_TOKEN` (CI sets them), falling back to `gh auth token`.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
