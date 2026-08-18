A read-through cache for the dashboard's slow questions — mostly GitHub ones, which cost hundreds of times a local git read — so a polling page never buys the same answer twice.

## TLDR

- Concurrent asks for the same thing share one lookup.
- A known answer is served instantly and refreshed behind the scenes once it ages; a failed refresh keeps the last good answer rather than dropping it.
- A first-ever ask waits only a moment before answering "pending" — meaning not known yet, not "no" — so a caller that must not act on a half-answer can hold off, and a slow lookup delays one panel's detail rather than the whole page.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
