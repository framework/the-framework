Priority: 2
Topics: [UX]
GitHub: [#1500](https://github.com/gemstack-land/the-framework/issues/1500)

# Error capability

## TLDR

New code-block capability letting agents show an error with a nice UI to the user — e.g. the abort case in the `update_tickets` preset prompt would use it instead of a programmatic instruction inside the prompt. Starts the shift from prompt-embedded instructions toward capabilities.

## Why it matters

Capabilities keep prompts declarative and give errors a consistent, user-friendly surface. Issue says not a priority for now, but fine as a quick win.

## Half of this already landed

#1604 shipped the store and the surface: a per-project error store (`src/project-errors.ts`) plus its UI — red dot in the sidebar, banner on the project page. Its one emitter is the daemon's data-branch sync. So the capability isn't building a system from scratch; it's a second emitter writing to the same store and rendering through the same banner.

## Open question: does the capability replace the daemon-side detection?

Raised by Rom reviewing #1604 — "old-school hard-wired code, I wonder whether we can remove hard-wired code and *just* give agents the capability".

Partly. Where an agent is running, yes: the capability is the better path and the hard-wired code can go. But #1604's own case has no agent in the loop — the failure is found by a background job on the daemon's clock, which is exactly why a broken ssh-agent went unnoticed. Nobody is there to call a capability. So the daemon likely keeps watching what happens *between* agent runs, and the two converge on one store and one UI rather than on one emitter.

Decide this once part 1 is built, when there's a real capability to measure the hard-wired code against.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1500](https://github.com/gemstack-land/the-framework/issues/1500), created 2026-08-04, labels: `UX ✨`, 1 comment (2026-08-20).
