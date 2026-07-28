---
"@gemstack/the-framework": patch
"@gemstack/framework-dashboard": patch
---

New `Auto-merge` setting (#1216), default off: a session armed for it merges the PR its handoff opens — GitHub auto-merge where the repo allows it, so the PR lands when its checks pass, else merged directly. Reachable as the `autoMerge` preference (launcher row, per-project overridable), the `the-framework.yml` key, and the `--auto-merge`/`--no-auto-merge` flags. The routine's [Drain queue] job turns it on for its own runs: what it implements was already triaged as consensual quick-win work, so its PRs land themselves and the #1334 loop closes without a human pressing merge.
