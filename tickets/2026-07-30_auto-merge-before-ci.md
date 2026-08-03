Status: open
GitHub: [#1406](https://github.com/gemstack-land/the-framework/issues/1406)

# Auto-merge lands before CI runs: repo lacks native auto-merge + a required build check

## TLDR

Auto-merge merges the PR immediately — it does not wait for CI (#1405 and #1407 merged ~3 seconds after opening; the `build` check ran after the code was already on main). Why: the code prefers GitHub's native auto-merge ("lands when checks pass") and only merges directly as a fallback, but this repo has native auto-merge disabled, so the fallback always fires. Fix is two repo settings, no code: enable **"Allow auto-merge"**, and make the **`build`** check required on `main` — then TF's existing preferred path takes over and an authorized merge waits for green CI.

## Why it matters

A broken PR merges just as fast as a good one, which unprotects the autonomy goal (#1334) that the agent-signal gate (#1392) otherwise guards. Accepted caveat: with a required check, every CI flake blocks a merge until rerun — the maintainer says the annoyance is okay for now, and having TF handle flakes itself is explicitly not a prio. The product-side question (users' repos where auto-merge is disabled — the GitHub default) is #1417.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1406](https://github.com/gemstack-land/the-framework/issues/1406), created 2026-07-30, no labels, 2 comments.
