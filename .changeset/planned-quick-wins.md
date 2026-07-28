---
'@gemstack/the-framework': minor
---

The routine now closes the loop on quick wins by itself. Bringing tickets across from GitHub joins the rotation, so a new issue becomes a ticket without anyone pressing the button; [Spike & plan] covers every ticket that has no plan yet and ends each one with its own verdict (`Effort:` and `Consensus:` keys in the plan's header); and a plan that calls its ticket a consensual quick-win is put on `TODO_AGENTS.md` by the daemon, under its own priority heading, for the drain to implement. No agent turn is spent re-deciding what the plan already decided. The verdict fails closed: a plan that says nothing, or says something unrecognized, is left for a human.

Also fixes the ticket priority mapping, which read only the ticket format's words (`urgent`/`high`/`low`) while every real ticket writes a number, so a queued ticket landed at the default priority 5 whatever it said.
