Scale mode: a self-maintaining `CODE-OVERVIEW.md` — an always-current map the agent reads first in a large repo — refreshed only on material change.

## Decisions

- **The thesis: a stale overview is worse than none** (it appears three times in the code, including inside the regeneration instruction the agent receives). So the refresh trigger is a pure, path-driven detector cheap enough to run on every loop event — not on-demand, not per-edit.
- Material-change signals: build/config file paths, test-tooling paths, caller-supplied extra patterns, a large change (many files **and** several distinct top-level directories — a 50-file change inside one directory is deliberately not material), and restructure keywords in the summary. The detector is injectable so a project can supply its own materiality policy.
- Regeneration seeds the previous overview into the prompt so the agent revises rather than rewrites blind.

## Facts

- The loop-prompt bridge for the overview returns prose, never a blockers verdict — adding it to a chain can never fail a blocking gate. (Currently unused by the product package.)

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
