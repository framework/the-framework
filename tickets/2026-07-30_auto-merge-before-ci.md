GitHub: [#1406](https://github.com/framework/the-framework/issues/1406)

# Auto-merge lands before CI runs: repo lacks native auto-merge + a required build check

## TLDR

Status 2026-08-21: **the code half is fixed, the repo half is untouched.** #1418 made the automatic path safe — `agent-handoff.ts` passes `whenUnarmed: 'watch'`, so a PR merges directly only if its checks already passed; otherwise the daemon's CI watch merges it on green. The original "#1405 and #1407 merged ~3 seconds after opening" can't happen through the automatic path any more (a merge a *human* asks for still goes straight through — deliberate). The repo settings are still off: `allow_auto_merge: false`, and `main` has no branch protection.

What's left is the two admin settings, for a slightly different reason than the OP gave: not to make the automatic path safe (it already is), but so the repo itself refuses red code no matter who asks — any direct merge (dashboard button, `gh pr merge`, GitHub UI) still lands whatever's there, and the CI watch only guards while the daemon is running: a live process, not a rule on the repo. Needs a human with admin:

- Settings → General → **Allow auto-merge** (native auto-merge then also replaces the watch fallback with something simpler)
- A branch-protection rule on `main` making the **`build`** check required

## Why it matters

Until the repo enforces it, a broken PR can still land whenever anything outside the framework's automatic path merges it, which unprotects the autonomy goal (#1334) that the agent-signal gate (#1392) otherwise guards. The OP's flake caveat is smaller now — the #1398 flakes were fixed in #1401/#1408. The product-side question (users' repos where auto-merge is disabled — the GitHub default) is #1417.

## Source

Imported from GitHub issue [framework/the-framework#1406](https://github.com/framework/the-framework/issues/1406), created 2026-07-30, no labels, 3 comments (last folded: 2026-08-21T21:30Z).
