Cloud work adoption [1]: the sweep [2] that, once per tick [3] of the daemon's clock, finds the branch a cloud session [4] actually worked on and records it onto the web agent [5]'s run [6], with the pull request the session opened for it, or the draft pull request this sweep opens when the agent was armed for one and the session never did. The match is exact rather than guessed: only the `claude/*` branch on origin that descends from the agent's cloud anchor [7] is the agent's. Anything unprovable is retried next pass, and an agent older than 48 hours is no longer asked about.

## Context

**User story**: a web agent's cloud session works on a branch of its own naming on claude.ai and pushes it. Within a tick or so of the push, the agent's row in the dashboard names that branch instead of the empty branch the agent was born on, its pull request resolves, and the "Merge" button can act on it; when the agent's record was armed for a pull request and the session opened none, a draft pull request appears, and the daemon's log says what was adopted and why something could not be. The dashboard starts no web agent today: the sweep adopts the work of any web agent on record, and stays for web agents' return.

**Problem**: a web agent is a local wrapper that hands the task to claude.ai and ends, so its own record knows only the empty `agent-<id>` branch it pushed the anchor on, and every surface keyed to that branch would read the agent as "nothing committed" while its work sits on origin under a `claude/*` name nothing recorded.

## Glossary

[1] cloud work adoption: recognizing the branch a cloud session pushed as the web agent's, by its descent from the agent's cloud anchor, and recording it on the agent's run.
[2] sweep: a background job the daemon runs on its clock: the data sync, the notification watchers, the cloud scratch sweep, cloud work adoption. None of them starts an agent.
[3] tick: one beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.
[4] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[5] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps. A web agent is one whose location is `web`.
[6] run: only the record of one finished agent, as the project's runs provider answers it (`store/runs.ts`): a card (what was asked, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[7] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognises that branch as the agent's.
[11] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[12] handoff: what becomes of an agent's work once the agent has ended: its branch pushed, a pull request opened for it, the pull request merged. The agent does it itself; on a finished agent's page the "Open PR" and "Merge" buttons do it by hand. A web agent's record may say what its handoff was armed to do: push, open a pull request, merge.

## Business logic — TL;DR

- **Which agents are owed an answer** - ended web agents with a cloud anchor, started within the last 48 hours, whose record still names their birth branch or, once the branch is adopted, whose armed pull request is still unaccounted for.
- **Fetching the cloud branches** - origin's `claude/*` branches are fetched once per pass, pruned so a branch deleted on origin stops matching; no remote or an unreachable one adopts nothing this pass.
- **Matching by descent from the anchor** - exactly one `claude/*` branch descending from the agent's cloud anchor is the agent's; none or several means retry next pass; an agent whose record names some other branch is not this sweep's to answer.
- **The pull request the session opened** - the branch's pull request history is read and the latest since the agent's start taken; a listing that fails opens nothing this pass and is reported.
- **Opening the armed draft pull request** - when no pull request exists, the agent was armed for one, it ended done, and the branch carries more than the anchor, a draft pull request is opened against the remote branch; a failure is reported.
- **Recording onto the run** - the branch (first time) and the pull request (once known) are set on the agent's run through the project's runs provider; nothing learned means nothing written and nothing said.
- **What is reported** - every adoption is logged with its branch and pull request; every failure is logged; a session that has not pushed yet is silence, not a failure.
- **The pass lifecycle** - no timer of its own: one pass over every registered project per tick, and a project whose pass fails adopts nothing this tick.

## Business logic

### Which agents are owed an answer

#### Context

**Business logic story**: the agent's process pushed the cloud anchor [7] and recorded it on the agent [5]'s record before its task left the machine; the agent's record is read here from the runs [6] the project's runs provider answers (`store/`), asking only for records started within the window so an ever-growing history is never read whole.

#### Business logic

An agent is waiting for adoption when all of these hold: its location is `web`; it is no longer running; it has a cloud anchor [7]; it started within the last 48 hours, its start read from the record or derived from its agent id [11], and an agent with no readable start is never waiting; and it is still owed something: either its record still carries the branch it was born on (no branch, or the `agent-<id>` branch), or the branch is already adopted but the agent ended done, was armed for a pull request, and none is recorded yet. An agent whose handoff [12] did not arm a pull request stops being asked about as soon as its branch is recorded: a pull request someone opens later is still found live, by branch name, by every surface that shows pull requests. A handoff the record does not mention counts as armed for a pull request, matching the agent's own default.

### Fetching the cloud branches

#### Context

**Problem**: the commits belong to a cloud machine this daemon never sees, so ancestry cannot be read until they are local, and fetching per head per agent per pass would multiply the calls.

#### Business logic

When at least one agent [5] is waiting, origin's `claude/*` branches are fetched once for the whole pass into a standing local copy, pruned, so a branch deleted on origin stops matching. A project with no remote, or one that cannot be reached, adopts nothing this pass and is retried next time. A second fetch of heads already local transfers nothing.

### Matching by descent from the anchor

#### Context

**Problem**: a cloud session [4] names its own branch, so no name can be predicted; the one thing only the agent's branch has is the agent's cloud anchor [7] in its history.

#### Business logic

For each waiting agent [5], the `claude/*` heads that contain the anchor commit are listed in one git question. Exactly one head is the agent's branch. None means the session has not pushed yet, or never will, and several is a history this sweep [2] cannot arbitrate; both are simply the next pass's question, without a word. An anchor whose commit is not local reads as no match, which is exactly the case where nothing has been pushed for it to be an ancestor of. An agent whose record names some third branch, neither its birth branch nor this head, is skipped: a pull request opened here would be recorded against a branch it does not live on.

### The pull request the session opened

#### Context

**User story**: a cloud session [4] often opens its own pull request; the agent [5]'s row must show that one rather than a second draft.

#### Business logic

The matched branch's whole pull request history is listed through `gh`. The pull request that belongs to the agent [5] is picked as `dashboard/gh.ts` picks it: an open pull request always; otherwise the latest one created after the agent's start, so a predecessor's pull request on a reused branch name is never this agent's. "None" and "could not list" are kept apart: a listing that fails is reported as "could not list the PRs of <branch> (<error>), so no draft PR was opened this pass", nothing is opened, and the agent is asked again next pass, because a second draft on a branch that already has one is the cost of guessing.

### Opening the armed draft pull request

#### Context

**Problem**: the agent [5]'s own end-of-agent handoff [12] could never open the pull request it was armed for, since it saw only the empty branch the agent was born on; this is that armed handoff finally resolving against the facts.

#### Business logic

When the listing succeeded and found no pull request, the agent [5] ended done, its handoff [12] was armed for a pull request, and the branch's head is beyond the anchor itself (so the session committed something), a draft pull request is opened for the remote branch with the same title and body rules as the "Open PR" button, draft so that a pull request The Framework opens by itself never puts a review request in anyone's inbox (`dashboard/agent-handoff.ts`). A failure to open it is reported as "could not open the armed draft PR for <branch>: <error>" and the branch is still recorded. An agent not armed for a pull request gets its branch recorded and nothing else.

### Recording onto the run

#### Context

See `## Context`.

#### Business logic

What the pass learned is set on the agent [5]'s run [6] through the project's runs provider: the branch, only when the record still carried the birth branch, and the pull request's number and URL, only when the record had none. When nothing new was learned, nothing is written and nothing is announced. A run that cannot be patched — no such run, a refusal, or a project with no runs provider — is reported as "could not record <branch> on the run's archive".

### What is reported

#### Context

**Problem**: an agent's row changing branch with no line explaining why reads as a bug; a line per tick about a session that has not pushed yet would be noise.

#### Business logic

Each adoption is logged as "[framework] session <agent id>'s cloud work landed on <branch> — adopted as its branch", followed by "; opened its armed draft PR <url>" when this pass opened it or "; its PR is <url>" when it was found. Each failure is logged as "[framework] cloud work adoption for session <agent id>: <error>". Unmatched agents are not mentioned.

### The pass lifecycle

#### Context

**Business logic story**: the pass walks the registered projects the way every daemon background pass does (`project-pass.ts`), on the daemon's single clock (`daemon-tick.ts`).

#### Business logic

The sweep [2] has no timer of its own: each tick [3] is one pass over every registered project, overlapping ticks join the pass in flight, and a stop takes effect between projects. A project whose pass fails adopts nothing this tick and is retried on the next.
