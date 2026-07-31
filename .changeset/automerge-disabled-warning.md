---
'@gemstack/the-framework': patch
'@gemstack/framework-dashboard': patch
---

The launcher warns when the merge rung is armed on a repo with GitHub auto-merge disabled (#1417): the armed merge silently degrades to an immediate direct merge — the PR lands before CI has run (#1406) — so the warning says so before the session is spent and names the fix (enable "Allow auto-merge" in the repo settings + mark a check as required). Never a block. Backed by a new cached `gh api repos/{owner}/{repo}` read of `allow_auto_merge` (`ghRepoAutoMerge` / `onRepoAutoMerge`); "gh could not say" renders nothing rather than crying wolf.
