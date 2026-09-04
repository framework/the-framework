The dashboard's view of a project's tickets: the rows the `tickets` skill reads off the project's `agent-data` branch, with the holder of every claim resolved against the project's own agents, so a claimed ticket names the session that is holding it instead of a bare identifier.

## User story

The user opens a project's Tickets page and sees its whole backlog: what each ticket is about, how urgent it is, which ones an agent has already planned, how much effort and uncertainty the plan recorded, when the tickets last caught up with GitHub — and, for a ticket an agent is holding right now, which of this project's sessions holds it, so the user can open that session rather than guess whether the claim is still alive. A project with no tickets at all shows an empty list, which is what the import offer sits on.

## Business logic — TL;DR

- **The rows are the skill's** - what a ticket is, what its title, summary, priority, topics, GitHub link and date are, what a plan and a claim beside it add, and the whole-file read behind a ticket's own page all belong to the `tickets` skill; this reads them for one project, off the checkout of its `agent-data` branch.
- **A claim's holder is resolved to an agent** - a claim names a holder, and when that holder is one of this project's own agents the ticket also carries that agent's id and the session name it chose, so the row can name the session and open its page.
- **An unknown holder is shown as written** - a holder this project has no record of — another machine's agent, a cloud session's branch name — is left exactly as the claim names it rather than being dropped or guessed at.
- **The lookup is paid only when something is claimed** - a list with no claim in it never reads the project's agents at all.
- **Nothing throws at the view** - records that cannot be read leave the holder unresolved, never fail the list.

## Business logic

### Naming the agent that holds a ticket

#### User story

The user sees a ticket is claimed and needs to know whose claim it is before deciding to wait for it or release it.

#### Business logic

A claim names its holder. A claim The Framework made — the sweep claiming a ticket for the agent it is about to start, or an agent on this machine claiming one with the `tickets` command — names that agent's id, which is also the name of the agent's own checkout. So the holder is looked up once, per list, among the project's agents: on a match the ticket carries the agent's id and the session name that agent chose, which is what lets the row name the session and link to its page. A holder that matches no agent of this project is shown as the claim wrote it, because it is still true and still the answer to "whose claim is this" — it just belongs to another machine or another kind of session. The agents are read only when at least one ticket in the list is claimed, and a failure to read them leaves every holder unresolved rather than failing the list.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
