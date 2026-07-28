Renders the production-grade loop's verdict (#431) — the current pass, blockers, or a production-grade/ended-early badge — the same wherever shown: session right rail, relay-watch overview strip, project home.

## Facts

- A projection of the run's own `checklist`/`improve`/`done` bootstrap events (`LoopStatus`): pass number, blockers, `passing`/`finished`/`productionGrade`.
- Badge says "ended early", not "stopped": the loop finishing without passing is not the user stopping the session (whose status label may say "stopped" for that).
- Titled in the sidebar's "Recents" voice (muted section label, not a caps card heading) so the two rails read as one app.
