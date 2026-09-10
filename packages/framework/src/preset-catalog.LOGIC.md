Holds every built-in preset in one table: fifteen rows, each naming the preset, its prompt (shipped as `prompts/presets/<stem>.md` and compiled in), its launcher [1] button's label, an optional one-line tooltip, what its one blank means when it has one, and whether it must always open an agent [2] of its own. From the table it derives the fourteen buttons the launcher shows, in order, and the rule that recognizes the prompt that drains [3] the agent queue [4]. The table reads nothing from the machine, so the dashboard renders any preset in the browser before an agent exists.

## Context

**User story**: on project home the user opens the presets menu of the launcher [1], picks a preset, and its whole prompt lands in the composer [5] with its target already filled in, ready to edit or to start as is. From inside an agent view [6] the same menu renders the preset against that agent's session name [7], so "Refactor … for readability" targets the work of the agent being looked at. The daemon fires the same rows on its own as routines [8], whose table is in `auto-pm.ts`: "Update from GitHub", "Add quick-win work to AI Queue", "Add consensual work to AI Queue" and "Plan tickets (aka spike)" as the rotation that refills the agent queue [4] when it is empty, "Spin up agents working on the AI queue" whenever the queue has work, and "Maintenance" on its own calendar.

**Problem**: a preset's name, prompt, label and blank must stay in step, so one row states them once. The prompt text itself stays in markdown so that a change to prompting is a readable diff; the table only says which prompt backs which button or routine.

## Glossary

[1] launcher: The Start form on project home, a project's own page.
[2] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[3] drain: Starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[4] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[5] composer: The prompt editor on project home, also used for live chat.
[6] agent view: One agent's page in the dashboard.
[7] session name: The name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[8] routine: A preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[9] prompt agent: An agent that runs one prompt and stops there; a build agent works the agent queue after its opening exchange.
[10] gate: A question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[11] routine lock: A file on the `agent-data` branch (`routines/<name>.lock.md`) a daemon takes before running a routine so the routine runs once across machines.
[12] driver session: The coding agent's own conversation for one agent, which the driver can resume by its session id.
[13] the Overview: The dashboard's cross-project page at `/`.
[14] unattended: Said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.

## Business logic — TL;DR

- **The table** - fifteen presets, each a name, a prompt from `prompts/presets/`, a button label, an optional tooltip, and for six of them what the one blank means.
- **Presets with a blank, and presets that scope themselves** - six presets wrap the user's target, the "what", whose default is the launching agent's session name or else the entire codebase; the other nine scope themselves to the repository's own tickets, plans or queue and render verbatim.
- **The triage pair shares one queue-only rule** - both triage prompts end with the same appended rule: only queue work, never do it.
- **"Update from GitHub" always opens its own agent** - picked from inside an agent view, it still starts a new agent rather than continuing that agent's driver session.
- **What the launcher offers, in order** - fourteen buttons in a fixed order; the drain is absent because only the daemon fires it.
- **Recognizing the drain prompt** - a prompt drains the agent queue exactly when its text equals the rendered drain preset, so a drain the user started by hand counts and a prompt that merely mentions the queue does not.
- **Which presets may run unattended** - the presets that stop at a gate need a human and never back a routine; the ones that end in work or in tickets do not, and only those are routines.

## Business logic

### The table

#### Context

See `## Context`.

#### Business logic

Each row carries the preset's name, by which the daemon's routines [8] and their routine locks [11] are known; its prompt; its label; its tooltip when the label alone does not say what the preset queues; and what its blank means when it has one. The rows, by label:

- "Research", name `research`, blank "What to measure problem variability of".
- "Maintainability", name `maintainability`, blank "What to refactor for maintainability".
- "Readability", name `readability`, blank "What to refactor for readability".
- "Security audit", name `security-audit`, blank "What to security-audit".
- "UX (auto)", name `ux`, blank "What to review the UX of".
- "Maintenance", name `maintenance`, blank "What to analyze for refactor opportunities", tooltip "Queue maintainability + security work per codebase subset (TODO_AGENTS.md)".
- "Market research", name `market-research`.
- "Update from GitHub", name `update-tickets`, tooltip "Bring `tickets/` up to date with the GitHub issues. An empty `tickets/` gets a full first import.", always a new agent [2].
- "Plan tickets (aka spike)", name `plan-tickets`, tooltip "Turn `tickets/*.md` into costed plans (`tickets/*.plan.md`)".
- "Suggest new tickets", name `suggest-new-tickets`: a single line the dashboard prefills and the user edits freely.
- "Suggest new features", name `suggest-new-features`, tooltip "Propose net-new features as tickets in `tickets/`".
- "Suggest tickets to work on", name `suggest-tickets-to-work-on`, tooltip "Add tickets to queue (TODO_AGENTS.md)".
- "Spin up agents working on the AI queue", name `drain-queue`, tooltip "Work the entries already on the queue (TODO_AGENTS.md)".
- "Add quick-win work to AI Queue", name `triage-quick`, tooltip "Add `tickets/*.md` to queue (TODO_AGENTS.md), only quick-win and consensual tickets".
- "Add consensual work to AI Queue", name `triage-consensual`, tooltip "Add `tickets/*.md` to queue (TODO_AGENTS.md), only significant (no quick-wins) and consensual tickets".

### Presets with a blank, and presets that scope themselves

#### Context

**User story**: the user clicks "Readability" on the launcher [1] and gets a prompt that already says what to refactor: the entire codebase from project home, or the agent's [2] own work from an agent view [6]. The user can replace that target with anything before starting.

#### Business logic

Six presets take one target, the "what": Research, Maintainability, Readability, Security audit, UX (auto) and Maintenance. Each prompt opens on that target: "Measure "problem variability" of <what>", "Refactor <what> to make it as maintainable as possible", "Refactor <what> to make it as easy as possible for humans to read", "Security audit <what>", "Review all UI flows of <what>", and "Analyze <what> and look for opportunities to refactor code". The rest of each prompt is in `prompts/presets/<stem>.md`. A blank or omitted target falls back to the default defined in `preset-prompt.ts`: the launching agent's session name [7], or "entire codebase" when no agent exists yet. The dashboard's presets menu always renders with that default, so a button runs with zero input, and the user edits the text afterwards. The agent process itself renders Research around the user's own text when an agent is started in research mode (`cli.ts`); Research runs as a prompt agent [9] rather than a build agent, since it reviews existing code and needs no build scaffolding. Maintenance's target is a plain blank because its prompt also embeds the paths of the Maintainability and Security audit presets, and one placeholder cannot nest inside another.

The other nine presets have no blank: each scopes itself to the repository's own tickets, plans or queue, so there is nothing for the user to fill in and the prompt renders verbatim. Market research refers to the session name as a placeholder the agent fills in itself rather than reading the launching agent's, because it is launched where no agent exists yet; both triage presets pin a fixed session name, `triage-quick` and `triage-consensual`.

### The triage pair shares one queue-only rule

#### Context

**Business logic story**: both triage presets read the tickets, pick the ones matching one filter, and add them to the agent queue [4]; that is how the queue refills itself from the ticket backlog. Both filters are consensual, meaning zero open questions and zero variability, so neither needs a human; they differ only in whether the work is cheap. Keeping them apart lets the daemon's rotation queue the cheap batch and the significant batch on separate turns instead of in one indiscriminate sweep.

#### Business logic

Each triage prompt is its own markdown followed by a blank line and the one rule in `prompts/triage_scope.md`: a triage only changes the queue, through the `queue add` command; it never implements a ticket, however small its plan, with no code changes and no pull request, so every ticket it picks goes on the queue where a human can still veto it. The rule is appended from one file rather than pasted into each preset, so the pair cannot drift apart on it. Each triage prompt also pins its own session name [7] and stops when the branch `agent-<session name>` already exists; that collision guard is what makes the pair safe to fire on a schedule, since a triage still in flight owns the branch and the next firing does nothing instead of triaging twice.

### "Update from GitHub" always opens its own agent

#### Context

**Problem**: syncing the tickets with the GitHub issues is work about the repository, not a reply in a conversation. Sent to a live driver session [12] it would land on that agent's [2] branch, behind that agent's context, with nothing to gain from the transcript and something to lose.

#### Business logic

The "Update from GitHub" row is marked as always running in an agent of its own. The composer [5] honors the mark (`dashboard/components/Composer.tsx`): picked from inside an agent view [6], the prompt starts a new agent instead of continuing the agent being looked at. The mark sits on the preset rather than on the surface that fires it, because it is a property of the work and not of where the user clicked. The prompt itself (`prompts/presets/update_tickets.md`) resumes from the last import time recorded in the repository and reconciles: an existing ticket is edited in place with its plan kept, a closed issue's ticket goes, and an empty `tickets/` gets every open issue as a first import.

### What the launcher offers, in order

#### Context

**Problem**: which presets are user-facing and in what order are one decision; a flag per row would state half of it and leave the order somewhere else.

#### Business logic

The launcher [1] shows fourteen buttons, in this order: "Research", "Readability", "Maintainability", "Security audit", "UX (auto)", "Suggest new tickets", "Suggest new features", "Suggest tickets to work on", "Plan tickets (aka spike)", "Market research", "Update from GitHub", "Maintenance", "Add quick-win work to AI Queue", "Add consensual work to AI Queue". "Spin up agents working on the AI queue" is not among them: only the daemon fires the drain [3].

### Recognizing the drain prompt

#### Context

**Problem**: the daemon knows a drain [3] by the mark on its routine [8], but an agent [2] the user started arrives as bare prompt text with no such mark, so the text is all there is to recognize it by. The dashboard needs that recognition to show which agents are working the agent queue [4]: a lane on the Overview [13], and which ticket an agent is implementing.

#### Business logic

A prompt drains the queue exactly when its text, ignoring surrounding whitespace, equals the rendered "Spin up agents working on the AI queue" preset. The comparison is against the preset as rendered now, not against a copy of its words, so rewording the preset cannot leave the rule behind. It is deliberately exact: a prompt that merely mentions the queue is not a drain, and mistaking one for the other would name a ticket as being implemented by an agent doing something else entirely.

### Which presets may run unattended

#### Context

**Problem**: a preset that ends by asking the user a question cannot be fired when nobody is there: the agent [2] would park at its gate [10] against a human who never answers.

#### Business logic

"Research" stops at a gate: it shows its ratings as a multiple-choice question the dashboard resolves live. "Suggest tickets to work on" also ends at a gate, so it is deliberately kept out of the routines [8]. "UX (auto)" ends in work rather than at a gate, so an agent started from it finishes on its own. "Suggest new features" proposes features as tickets rather than asking for approval mid-agent, so a human triages its proposals later and it stays usable unattended [14]. The routines are built only from rows that need no human: "Update from GitHub", the two triage presets, "Plan tickets (aka spike)", "Spin up agents working on the AI queue" and "Maintenance".
