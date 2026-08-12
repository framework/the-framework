The built-in prompts library — the bodies of the follow-up checks the loop dispatches, shipped as editable markdown data, plus the bridge that makes them runnable.

## TLDR

- A prompt is data: frontmatter (dispatch id, title, passes, target change kind) plus a markdown instructions body — improving a check means editing prose, not code.
- The shipped bodies register under the exact ids the default loop policy references, so the loop resolves to real checks out of the box.
- The bridge composes each run's instructions from the decisions briefing (what was already rejected) plus the body, renders the change into task text, and builds a fresh agent per pass — fresh eyes are the point.
- Ownership split: this subsystem owns what a check says; the loop owns when it runs; the agent factory the caller injects owns how (model, tools).

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
