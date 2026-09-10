The fifteen presets: the canned prompts behind the launcher's buttons and the daemon's routines [2], one markdown file each. Five of them are quality passes over a target the user names; one sweeps the code and queues quality work; four are product management, proposing or picking tickets; four are the routines that keep the tickets and the agent queue [4] fresh; and one is the prompt of a drain [5] agent [1], which only the daemon fires. The table in `src/preset-catalog.ts` says which button or routine each backs, in which order the launcher shows them, and appends the queue-only rule of `../triage_scope.md` to the two triage presets.

## Context

**User story**: a project's launcher offers, in this order, "Research", "Readability", "Maintainability", "Security audit", "UX (auto)", "Suggest new tickets", "Suggest new features", "Suggest tickets to work on", "Plan tickets (aka spike)", "Market research", "Update from GitHub", "Maintenance", "Add quick-win work to AI Queue" and "Add consensual work to AI Queue"; the first five take an optional target, the rest need nothing typed. With Auto PM [3] on, the daemon fires "Update from GitHub", the two triages and "Plan tickets (aka spike)" in that rotation, "Maintenance" on its own calendar, and the drain whenever the queue has an entry. The user's own saved prompts, the custom presets, are kept in the registry, not here.

**Business logic story**: the five targeted presets take one parameter, `${{ tf.params.what }}`, filled by the rule in `src/preset-prompt.ts`: the user's text, trimmed, or when blank the session name of the agent the preset was launched from, or "entire codebase" when there is none, which is what a routine gets. The other presets scope themselves to the project's tickets, plans or queue and render verbatim. Six presets are also written to a project's `.the-framework/presets/<stem>.md`, namely `maintainability`, `readability`, `security_audit`, `research`, `ux` and `maintenance`, so that a queue entry can name one for a later agent to open and run. Two presets end in a gate [6], "Research" and "Suggest tickets to work on", and are therefore never fired unattended [7]; "UX (auto)" and "Suggest new features" are unattended by design; "Update from GitHub" always starts an agent of its own.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] routine: a preset the daemon fires on its own on a schedule (update tickets, triage quick, triage consensual, plan tickets, maintenance), each switchable off and runnable on demand.
[3] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[4] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[5] drain: starting an agent on the agent queue's first open entry; the half of Auto PM that spends existing work.
[6] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[7] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[8] fan-out: starting several agents at once, one per queue entry or one per ticket to plan.

## Business logic — TL;DR

- **Research** (`research.md`) - rate every problem the target's code solves for how obviously optimal its solution is, let the user pick the doubtful ones at a gate [6], and write a deep-dive follow-up per pick into a per-session to-do file.
- **Readability** (`readability.md`) - rate every file and unit of logic for a human reading top to bottom, fix the split, the seams and the altitude one commit per refactor, and report old and new ratings.
- **Maintainability** (`maintainability.md`) - find maintainability red flags in the target and fix them; deliberately minimal.
- **Security audit** (`security_audit.md`) - scrutinize the whole target for security issues with a verdict per aspect, and fix each issue in its own commit.
- **UX (auto)** (`ux.md`) - list and rate every UI flow, improve the badly rated ones one commit each, and report old and new ratings, without asking anything.
- **Maintenance** (`maintenance.md`) - analyze the target for refactoring opportunities and queue, per subset of the code that needs it, a maintainability pass and a security audit at low priority; also the routine [2] on its own calendar.
- **Market research** (`market_research.md`) - research the market, write `knowledge-base/MARKET_RESEARCH.md`, and queue a follow-up that turns it into ticket proposals.
- **Suggest new tickets** (`suggest_new_tickets.md`) - one editable line: propose new tickets and write each through the `tickets` skill.
- **Suggest new features** (`suggest_new_features.md`) - study the product, propose net-new features as tickets, and summarize them in the right rail, without asking anything.
- **Suggest tickets to work on** (`suggest_tickets_to_work_on.md`) - pick tickets to work next, let the user approve them at a gate, and queue each approved one at its own priority.
- **Update from GitHub** (`update_tickets.md`) - bring the tickets up to date with the GitHub issues since the last import, one ticket per issue, removing closed ones and recording the new import mark; the first routine of the rotation.
- **Add quick-win work to AI Queue** (`triage_quick.md`) - queue the tickets whose plan shows a quick win with no uncertainty, cheapest first, and nothing else; the second routine.
- **Add consensual work to AI Queue** (`triage_consensual.md`) - queue the significant tickets with no open question and no variability at their own priority, and nothing else; the third routine.
- **Plan tickets (aka spike)** (`plan_tickets.md`) - queue a plan for the 10 most important unplanned, unclaimed tickets; as the last routine it fans out [8] into one agent per claimed ticket that writes the plan itself.
- **Spin up agents working on the AI queue** (`drain_queue.md`) - work the first open entry of the agent queue [4] and only it, marking it done once published; fired by the daemon, never a launcher button, and recognized as a drain [5] by its exact text.
