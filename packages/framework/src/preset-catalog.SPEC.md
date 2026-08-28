The catalog of every built-in preset: one table holding, per preset, its name (the stable identifier the launcher and agent records key on), its prompt template, its launcher label and tooltip, and how its one blank is filled. The prompt text itself ships as markdown files in the package, so a prompt is edited as prose in one place; the catalog is free of Node built-ins so the dashboard can render any preset in the browser.

## Glossary

- **materialized preset** — a preset's prompt written to disk under `.the-framework/presets/`, so an agent queue entry can point at it by file path.

## Business logic — TL;DR

- **Two families** - the quality presets take one target ("what to run against", defaulting to the launching session or the whole codebase); the ticket/queue presets scope themselves to the repo's own tickets, plans, or queue, so there is no blank to fill.
- **Each preset's contract** - what each canned prompt asks for, including which ones gate on a human and which run unattended.
- **The triage pair** - two unattended triage presets split on cost, share one verbatim queue-only rule, and each aborts when its own branch already exists, making them safe to fire on a schedule.
- **Recognizing the drain** - a bare prompt is recognized as the queue-draining one by exact match against the rendered preset, so the recognition can never drift from a reworded prompt.
- **The launcher list** - one ordered list of the user-facing presets; `drain-queue` is absent because only the daemon fires it.

## Business logic

### Two families

#### User story

From the dashboard's launcher the user picks a preset to start an agent: quality passes over some target, or product-manager work over the repo's tickets and queue.

#### Business logic

The quality presets — maintainability, readability, security_audit, ux, research, maintenance — take a single target the user may type; left blank, the target defaults to the session the preset was launched from, or to the entire codebase when no session exists yet. The ticket/queue presets — triage_quick, triage_consensual, plan_tickets, update_tickets, suggest_new_tickets, suggest_new_features, suggest_tickets_to_work_on, drain_queue, market_research — read the repo's own `tickets/`, plans, or agent queue, so their prompt renders verbatim with nothing to fill.

### Each preset's contract

#### User story

Each preset is a distinct product feature: the user (or Auto PM) picks the one matching the work they want done, and its gating behavior must match how it is fired — a preset fired unattended must never park waiting for a human.

#### Business logic

- **research** — measure the "problem variability" of the target; gates on a multi-select the dashboard resolves, and routes the picks into a session-scoped TODO file (`TODO_<session name>.agent.md`) beside its review file, deliberately not into the agent queue — queue entries would defer the research follow-ups to a later drain instead of the session doing them.
- **maintainability / readability / security_audit** — refactor or audit the target; each demands full coverage and one commit per refactor or finding.
- **ux** — rate every UI flow of the target, then fix the low scorers. Unattended by design: it ends in work, never in a gate, so an agent started from it finishes on its own; its prompt carries a laziness guard against all-perfect ratings.
- **maintenance** — analyze the target and queue maintainability/security follow-up work per codebase subset onto the agent queue (`TODO_AGENTS.md`), pointing at the other quality presets by their materialized file paths — it queues work rather than doing it.
- **market_research** — research the market, write `knowledge-base/MARKET_RESEARCH.md`, then queue a follow-up that turns the findings into tickets. Its prompt defines its own session name, because it launches before any session exists.
- **update_tickets** ("Update from GitHub") — the one GitHub sync: bring `tickets/` up to date with the GitHub issues. It resumes from the `lastImportedAt` stamp in `tickets/meta.json` (taking the new stamp before fetching, so an issue edited mid-run comes across next time), syncs issue comments too, and reconciles rather than refills: an existing ticket is edited in place so the plan written against it survives, and a closed issue's ticket is removed. An empty `tickets/` is the first-import branch — every open issue comes across — which is why no separate import preset exists. The only preset that always opens an agent of its own, even when picked from inside a live one: syncing is repo work, not a reply.
- **plan_tickets** — turn `tickets/*.md` into costed plans (`tickets/*.plan.md`).
- **suggest_new_tickets** — one prefilled line the user edits freely in the launcher.
- **suggest_new_features** — study what the product does today and propose net-new features as tickets in `tickets/`. Unattended: a proposal is a reviewable ticket, so the human triages later instead of approving mid-run.
- **suggest_tickets_to_work_on** — the gated sibling of the triage pair: pick tickets via a multi-select, then add the approved ones to the agent queue. Because it gates, it is deliberately kept out of Auto PM's unattended routines.
- **drain_queue** — work the entries already on the agent queue. Daemon-only.

### The triage pair

#### User story

Auto PM refills the agent queue from the ticket backlog on a schedule, with nobody around to answer questions or notice a double-fire.

#### Business logic

Both triage presets read `tickets/*.md`, pick tickets that are consensual (zero open questions, zero uncertainty), and append them to the agent queue. They split on cost only: triage_quick picks quick wins (low effort, zero uncertainty per the plan's own numbers), triage_consensual picks significant work — kept apart so the cheap batch and the significant batch queue on separate turns. Both run unattended and never gate. Each pins its own fixed session name and aborts when the branch `agent-<session name>` already exists: a triage still in flight owns the branch, so the next scheduled firing does nothing instead of triaging twice. Both end with the same queue-only rule, appended verbatim from one shared prompt file so the pair cannot drift apart on it: a triage changes only `TODO_AGENTS.md`, never a ticket's code.

#### Rationale

The queue-only rule exists because a triage once queued two tickets and implemented the third itself; sharing it as one file rather than pasting a phrase into each preset is what keeps the rule identical in both.

### Recognizing the drain

#### Business logic

Whether a bare prompt is "the one that takes work off the agent queue" is decided by exact, trimmed comparison against the rendered drain preset. The daemon knows its own drains by a flag, but an agent started by hand arrives as prompt text with no marking, so the text is all there is to recognize it by. Comparing against the rendered preset (not a copy of its words) means rewording the preset cannot silently break the recognition; exactness means a prompt that merely mentions the queue is not mistaken for a drain, which would mislabel what an agent is implementing.

### The launcher list

#### Business logic

The presets the launcher offers, in display order, are one explicit list: every preset except drain_queue, which only the daemon fires. Membership and order are one decision, and the list doubles as the answer to "which presets are user-facing".

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
