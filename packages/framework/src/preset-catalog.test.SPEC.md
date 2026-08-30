What the tests cover, for the whole built-in preset catalog:

- Every preset's name is pinned exactly — a rename silently breaks the launcher button and the file path queued entries point at.
- The launcher offers every preset except the daemon-only drain_queue, and each offered preset has a label.
- Every quality preset takes exactly one target, falls back to its default when the target is blank or omitted, and leaves no unrendered placeholder; every ticket/queue preset renders its template verbatim with nothing left to fill; a quality preset launched from a live session targets that session by name.
- The quality prompts keep their core instructions: full coverage, seams/altitude passes and one commit per refactor (readability), verdicts per finding (security_audit), the 0–10 rating scale and per-flow commits (ux).
- ux runs to completion — no gate of any kind — and keeps its guard against lazily perfect ratings.
- research gates on a multi-select and routes the picks to a session-scoped TODO file beside its review file, deliberately never to the agent queue.
- maintenance queues work per codebase subset with the skill's queue-add command, at a low priority, rather than doing it, and points at the other presets by their real materialized file paths with no placeholder surviving the render.
- market_research researches, writes its findings file, queues the ticket follow-up, and defines its own session name (no session exists when it launches).
- suggest_new_tickets is the one prefilled line, which has each new ticket written with the `tickets` skill's own command; suggest_tickets_to_work_on lists the tickets through the skill, gates on a human multi-select, and puts each approved ticket on the queue with the skill's queue-add command, naming the ticket it came from.
- The triage pair splits on cost (quick wins by the plan's own effort/uncertainty numbers vs. significant-only), both put their picks on the queue with the skill's queue-add command, both end with the shared queue-only rule verbatim (the queue, through that command, is the only thing they change), each pins its own distinct session name and neither carries any branch-already-exists abort — keeping one triage at a time is the daemon's routine lock, not a rule the agent checks — and neither ever gates, while the gated sibling still does.
- Only update_tickets is marked to always open an agent of its own, and it stays offered in the launcher; its prompt resumes from the `tickets/meta.json` stamp (taken before fetching), syncs issue comments too, preserves existing plans, removes closed issues' tickets, and treats a project with no tickets as the full first import.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
