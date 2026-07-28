One run's action bar: what the session IS (branch/PR/summary via `GitStatusBar`, as a disclosure) on the left, and what you can DO (handoff `actions` + `SessionActionsMenu` ⋮ overflow) on the right.

## TLDR

- Left: `GitStatusBar` with `inline`, session `label`, `project / session` breadcrumb, `summary`, disclosure `expanded`/`onToggle`, and a `runState` pill.
- The status pill comes from `runStatusPill(events)` — exactly one of stopped / ready for merge / failed / building / finished — rendered beside the tree's clean/dirty instead of the old full-row banner over the feed; capped `max-w-40 truncate` since a failure label carries its reason.
- Right: caller-supplied `actions` (the handoff's Push / Open PR next step — the one thing that moves the work forward stays visible) then the ⋮ `SessionActionsMenu`.
- One bar for the session whether running or finished (used by RunView), so controls stay put when a run reaches Done.

## Decisions

- Single overflow menu instead of a row of state-dependent icon buttons; only the handoff's next step stays out as a visible button.
- One row always (#1026): branch and summary give up width as the row fills; the grow-only spacer (`grow shrink-0`, #1030) means a tight row takes width from the label, and controls never wrap under.
