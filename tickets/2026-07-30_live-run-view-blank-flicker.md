GitHub: [#1383](https://github.com/gemstack-land/the-framework/issues/1383)

# Dashboard: live run view flickers blank mid-run; white screen for a while after closing a run

## TLDR

One observation remains of the original three: the live transcript can go blank mid-run for a stretch, then recover with the full transcript. Mechanism identified: `use-live-events.ts` blanks the buffer on every (re)subscribe (`setEvents([])`) and the server replays the whole log line by line — so any transient channel drop shows an empty, banner-less feed until the replay refills it (a daemon restart mid-run reproduces it on every open view). Fix direction, per the #1402 principle (never show less than was already shown): add a replay-done sync sentinel to the channel (server side: `stream-channel.ts` / `events-tail`) so the client can buffer the replay and swap atomically.

## Why it matters

A feed that visibly collapses mid-run reads as data loss even though the journal is intact throughout — cosmetic, but trust-destroying in the surface users watch most closely.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1383](https://github.com/gemstack-land/the-framework/issues/1383), created 2026-07-30, no labels, 2 comments.

### Original description

Two occurrences during the manual test matrix on 2026-07-30 (daemon on main build, #1373/#1377 merged):

1. Run `2026-07-30T00-14-58-192Z` (matrix row 2): mid-run, the message area went blank for a stretch — "screen was showing no message, like flickering" — then recovered and showed the full transcript.
2. Run `2026-07-30T00-21-32-410Z` (matrix row 3): after closing the run view, the page went **white for some time** before rendering; on reload the full transcript (including the handoff line) was there.

No console logs captured yet, no repro steps — filing as an observation with two data points so it stops being folklore. Both runs were trivial single-turn builds, so this isn't a long-transcript rendering cost.

### Notes from the GitHub thread (triage narrowed the scope)

- A third occurrence gave a concrete repro (Stop on a settled session → "This session has no events." until refresh) — since fixed twice over: #1402 (an empty archive read never replaces a populated feed) and #1411 (settled sessions end themselves, so the parked-on-Stop state no longer exists).
- The white-screen-after-closing observation is almost certainly the white-blank bug (#1194, which had its own deterministic repro) and was dropped from this issue's scope; #1194 has since been closed as fixed.
- What remains is the mid-run blank flicker — mechanism and fix direction in the TLDR (status check of 2026-07-31 against post-#1402/#1411 main).
