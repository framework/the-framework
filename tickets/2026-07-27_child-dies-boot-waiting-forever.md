Status: open
Topics: [bug]
GitHub: [#1261](https://github.com/gemstack-land/the-framework/issues/1261)

# A run whose child dies at boot shows "Waiting for the session to start" forever

## TLDR

When the spawned child crashes on startup (hit live: a module resolution error, see #1262), the crash is invisible — runs spawn with stdio ignored, no `run.json` is ever written, and the session page polls "Waiting for the session to start" indefinitely with nothing in the daemon log. The daemon already knows (the child's exit handler fires on the immediate death): write a failed marker or a minimal `run.json` with status failed + exit code so the page can say "the session failed to start", and capture the child's stderr tail into the run log to make the cause visible.

## Why it matters

A silent boot death turns an infra hiccup into an unbounded user wait with zero diagnostics — it's what let the #1262 symlink corruption brick every session before anyone could see why. Per the #1262 thread, PR #1272 makes the boot death visible and names the failing module in the run log.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1261](https://github.com/gemstack-land/the-framework/issues/1261), created 2026-07-27, label: `bug`.

### Original description

Hit live today. The daemon allocated the worktree and spawned the child, the child crashed on startup (module resolution error, see the companion issue), and because runs spawn with stdio ignored the crash went nowhere. No run.json was ever written, so the session page polls \"Waiting for the session to start\" indefinitely and nothing in the daemon log says why.

The daemon already knows: the child's exit handler (settle in daemon-runtime) fires on the immediate death. It could write a failed marker (or a minimal run.json with status failed and the exit code) so the page shows \"the session failed to start\" instead of waiting forever. Capturing the child's stderr tail into the run log would make the cause visible too.

Repro used: run the exact spawn command by hand with stdio visible; the import error prints immediately.
