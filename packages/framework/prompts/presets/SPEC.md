One file per preset: the canned prompts behind the dashboard's launcher buttons and the daemon's routine work. Each file is one preset's complete instruction to an agent, written as prose, so what a button does is read and changed as markdown.

## User story

- The user wants recurring work — a readability pass, a security audit, a triage of the ticket backlog — without writing the prompt for it every time. One click starts an agent with the wording that has already been tuned for that job.
- The user wants that work to keep happening when they are not there. The daemon fires the same prompts on a schedule as its routine work.

## Business logic — TL;DR

- **Two families** - the quality presets take a target from the user; the ticket and queue presets scope themselves to the repo's own tickets, plans and queue and take no input at all.
- **The ticket and queue presets go through the `tickets` skill** - they name the skill and its command as how a ticket or a queue entry is read, written, claimed or taken off the queue; none of them edits a file in the agent's checkout.
- **A quality preset's target defaults to something useful** - left blank, it runs against the session it was launched from, or against the entire codebase when there is no session yet.
- **Presets can queue other presets** - a preset's text can name another preset's file, so the queued entry tells a later agent exactly which preset to apply and to what.
- **Some presets end in a question, others end in work** - which one a preset does decides whether it is safe to fire unattended.
- **The two triage presets share one appended rule** - `triage_scope.md` is appended to both so they cannot drift apart on the rule that a triage only queues work.

## Business logic

### Two families

#### User story

See `## User story`: some presets act on code the user points at, and some act on the roadmap, which points at itself.

#### Business logic

The quality presets — maintainability, readability, security audit, UX, maintenance, research — take one input, the target to run against, which the launcher asks for in the preset's own words ("what to refactor for readability", "what to security-audit", and so on).

The ticket and queue presets — the two triages, plan tickets, update tickets, suggest new tickets, suggest new features, suggest tickets to work on, drain queue, market research — take no input: each scopes itself to the repo's own tickets, plans or agent queue, so there is no blank for the user to fill.

### The ticket and queue presets go through the `tickets` skill

#### User story

The user's tickets and agent queue are not in the agent's checkout: they live on the `tickets` branch. A preset that told the agent to open a file would send it to a file that is not there.

#### Business logic

Every preset that touches a ticket or the queue names the `tickets` skill and the command it provides: listing the tickets, reading one with its plan, writing a ticket, a plan or the import stamp, closing a ticket, putting an entry on the queue at a priority, and taking a finished entry off it. No preset edits a ticket or the queue as a file, and none of them commits one on the agent's own branch.

### A quality preset's target defaults to something useful

#### User story

The user clicks a preset button without typing anything, and expects it to do the obvious thing.

#### Business logic

A blank target falls back to the name of the session the preset was launched from — so a preset picked from inside a running agent reviews that agent's own work — and to the entire codebase when no session exists yet, which is the case in the launcher.

### Presets can queue other presets

#### User story

The user wants a maintenance sweep, or a finished agent, to leave behind quality work that actually gets done rather than a note that it should be.

#### Business logic

A preset's text can name another preset by file path, and the presets that need it put agent-queue entries of the form "apply this preset with its target set to that" on the queue with the `tickets` skill's command. A later drain of the agent queue turns each entry into its own agent, which opens the named preset file and runs it. This is how the maintenance preset spreads maintainability and security work across the codebase, and how a finished agent queues quality follow-ups on its own changes.

### Some presets end in a question, others end in work

#### User story

The daemon fires presets when nobody is around. A preset that parks on a question would leave an agent waiting for a person who is not there.

#### Business logic

Each preset either ends by parking at a gate for the user to answer — research, and suggest tickets to work on — or ends in work it completes by itself. Only the latter are fired as routine work; the gated ones are launched by a user who intends to answer.

### The two triage presets share one appended rule

#### User story

Triage must stay a proposal the user can veto, in both of its variants.

#### Business logic

The rule that a triage only queues work and never implements it lives in one file and is appended to both triage prompts when they are rendered, so the pair cannot drift apart on it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
