Priority: 8
Topics: [bug]
GitHub: [#1173](https://github.com/gemstack-land/the-framework/issues/1173)

# Unclear UX: what should I do now?

## TLDR

When an agent finishes, the page didn't say what to do next. Partially shipped via #1178 (the action button now appears once the agent settles, instead of two checkboxes sitting there). The remaining direction was settled in-thread after `Open PR` failed with "No commits between main and \<branch\>" (the agent had left its work uncommitted): favor autonomy — default to `[x] Open PR`, auto commit & push is safe since every run is on its own branch; postpone the commit/push settings split (`Auto commit` / `Auto push`); and don't offer `Open PR` on a branch with no diff — say so and name the uncommitted work.

## Why it matters

The settle moment is the hand-off from AI to human; if the user has to guess what to do, every session ends in confusion. Two sessions dead-ended because work was silently left uncommitted — the quickest-fix stance (always open a PR, commit automatically) is what makes the autonomous flow work.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1173](https://github.com/gemstack-land/the-framework/issues/1173), created 2026-07-25, labels: `bug`, `priority: high`, 6 comments.

### Original description

The agent is finished, what should I do now?

<img width="1366" height="729" alt="Image" src="https://github.com/user-attachments/assets/cdf94a0c-c7df-44a6-b9ac-b0503ce3ee71" />

### Notes from the GitHub thread

- Shipped in #1178: the primary button appears once the agent settles (issue re-opened after a new screenshot).
- Found while testing: `Open PR` failed with `No commits between main and <branch>` — the agent edited files and never committed, so there was genuinely nothing to open a PR from. Follow-ups: don't offer the button when there's no diff (say so and name the uncommitted work); same cleanup in the launcher gear (one row: `Open PR`; the push setting stays available in `the-framework.yml` and the CLI flag).
- Maintainer direction: postpone the whole commit/push setting (possibly split into `Auto commit` + `Auto push` later); take the quickest fix — always `[x] Open PR`; unattended runs can commit automatically ("the more autonomous the better"), safe because a branch is always created.
