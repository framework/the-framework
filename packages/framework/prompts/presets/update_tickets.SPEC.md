The update-tickets preset: brings the project's tickets up to date with the repo's GitHub issues. It reconciles rather than refills — carrying across only what changed since the last import, editing existing tickets in place, and deleting the tickets of closed issues. Every write goes through the `tickets` skill's command, which commits and pushes it to the `tickets` branch on the spot.

## User story

- The user keeps their roadmap as tickets but their team files GitHub issues. They want one button that makes the tickets reflect the issues, repeatedly, without losing the plans already written against those tickets.
- The user should never be told an import happened when it did not.

## Business logic — TL;DR

- **Timestamp first, fetch second** - the agent notes the current UTC time before fetching anything and records that as the new import stamp at the end.
- **Three branches: error, first import, incremental** - a missing stamp with tickets present or an unusable GitHub CLI aborts; a project with no tickets imports every open issue; otherwise only what changed since the stamp is fetched.
- **One ticket file per issue** - new issues gain tickets, known issues are updated in place, closed issues lose their ticket entirely; each of those is one command, hence one pushed commit.
- **Plans survive an update** - an updated ticket keeps its filename and its plan, and the plan is considered for marking as outdated rather than deleted.
- **Comments are folded in, never pasted** - discussion matters only where it changes what the work is.
- **It ends with the stamp and a count** - the new import stamp is written and the agent reports in one line how many tickets it added, updated and removed.

## Business logic

### Timestamp first, fetch second

#### User story

See `## User story`: the update runs repeatedly, so nothing may fall between two runs.

#### Business logic

Before fetching anything the agent notes the current UTC time in ISO 8601, and that is the timestamp it records at the end.

#### Rationale

Taking the timestamp first is deliberate: an issue edited while the agent works is then picked up by the next update instead of being missed, because the recorded stamp predates the change.

### Three branches: error, first import, incremental

#### User story

See `## User story`: the project may have no tickets at all, may be up to date, or may be in a state the agent cannot safely reason about.

#### Business logic

The agent reads the last import stamp from `tickets/meta.json` on the `tickets` branch, and asks the skill whether the project has any ticket at all. It then does exactly one of three things:

- **Error** — there are existing tickets but no stamp, or the GitHub CLI is missing or logged out: the agent reports which of those it is and aborts.
- **Empty** — there are no tickets: the agent treats this as a first import and brings every open issue across.
- **Update** — otherwise the agent fetches only what changed since the stamp: issues of any state updated since then, and the discussion comments posted since then.

#### Rationale

Tickets without a stamp is the one state where reconciling is unsafe — the agent cannot tell which tickets came from issues and which were written by hand — so it refuses rather than guessing. Having no tickets at all is unambiguous, which is why the first import needs no separate preset.

### One ticket file per issue

#### User story

See `## User story`: the mapping must stay stable across runs, because plans, locks and queue entries all point at ticket filenames.

#### Business logic

Reconciliation is per issue:

- an issue with no ticket yet gets one;
- an issue that already has a ticket has that ticket updated in place, keeping its filename;
- an issue that is now closed loses its ticket, its plan and its claim — the skill's close command removes all three together.

An updated ticket keeps its plan file, and the agent considers marking that plan as outdated instead of removing it. New comments are folded into the ticket only where they change what the work is — the thread itself is never pasted in.

### It ends with the stamp and a count

#### User story

The user wants to know what the sync did without reading the diff.

#### Business logic

The agent finishes by writing `tickets/meta.json` with the timestamp it noted at the start, and states in one line how many tickets it added, updated and removed. The stamp is written last and by the same command as everything before it, so it is only ever recorded behind tickets that are already on the branch — an update that stopped halfway leaves no stamp claiming those issues were imported, and the next run picks up from the older one.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
