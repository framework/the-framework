The dashboard UI: a browser app served by the daemon that renders everything the daemon knows and steers agents through it — holding no authoritative state of its own.

## User Stories

- The user starts an agent from the composer: a typed prompt starts an attended build, a picked preset an unattended one.
- The user is warned before an agent is spent when something would block its handoff.
- The user watches an agent as a live transcript and answers the questions it parks on right where they happened.
- The user chats with a live agent, stops it, or resumes a stopped one.
- The user reviews an agent's changed files and diffs and hands the work off — push, open a PR, merge.
- The user sees on one overview everything that needs them: the quota bar, every unanswered question across all projects, agents working now, the AI queue, routine work, and the hottest tickets.
- The user browses every project's tickets in one filterable list, shares the filtered view as a URL, and starts an agent straight from a ticket.
- The user follows an onboarding checklist whose steps are ticked by real facts, not by clicking them.
- The user tunes every preference in settings, from appearance to automation and spend.

## Flows — TL;DR

- Every read is a projection of daemon state; every write is a call into the daemon.
- The URL is the selection, so every view is a link to paste, reload, or bookmark.
- A live agent streams its events; everything else polls; a finished agent reads from the archive.
- The dashboard is a plain client-side app behind one static page the daemon serves.
- The overview leads with the quota bar, then everything that needs the user.
- The composer starts agents and is a live agent's control.
- The agent view is the transcript with every control inline.
- Tickets are the cross-project roadmap surface, filterable and shareable by URL.
- Settings gathers every preference on one page.

## Flows

- Every read is a projection of state the daemon assembles (agent logs, tickets, the queue, git and GitHub state, preferences); every write is a call into the daemon. The one exception is saved remote devices: their access tokens stay in this browser only, handed to the daemon per call.
- The URL is the selection: the overview at `/`, a project at `/{projectId}`, one agent at `/{projectId}/{agentId}`, plus cross-project tickets, a per-ticket page and its plan page, and settings. An agent is a link you can paste, reload, and bookmark — there is no selection state to disagree with the address bar.
- An agent's events stream live over one channel bound to its own log; everything else polls. A finished agent reads from the archive instead, catching up whenever the live channel outgrew it.
- The dashboard is a plain client-side app: one static page the daemon serves for every address, and all the behaviour in the browser — no server rendering, no framework between the page and the app.

**The overview** is ordered by what governs what. The quota bar comes first — a week-track with pace and projection, the one figure that decides what agents may do next. Then everything that needs *you*: the open-questions hub, every agent's unanswered question across all projects, answerable right there in one scrolling view. Then the agents working now, the full AI queue of every project (uncollapsed: a plan you cannot read is not a plan), routine work, and the hottest tickets. An onboarding checklist sits on top until dismissed. Each step's "done" is derived from a real fact — a registered project, a ticket on disk, a granted permission, stored credentials — so a step cannot be ticked by clicking it, and work done outside the dashboard shows up ticked anyway.

**The composer** starts and steers agents. Typing a prompt starts an attended build; picking a preset starts an unattended one. In-editor triggers pull in presets and actions, files, projects, and macro tags (the angle-bracket placeholders preset prompts use); option menus write straight to the user's or project's preferences. Pre-flight checks warn before the agent is spent — a missing or logged-out GitHub CLI, a repo that can't auto-merge. On an agent, the composer is its control: a live one takes messages (options are baked at spawn and hidden), a stopped one offers to resume with reduced options, and the submit slot doubles as Stop while it works.

**The agent view** is a transcript with the controls inline: its questions render as answerable cards exactly where they happened (resolved ones collapse to a checkmark), and its live browser screencast renders inline too, degrading to a last still when the agent ends. Around the transcript: changed files with diffs, git status, the handoff panel (push, open PR, merge), agent-authored views, docs, and history rails, and an actions menu (stop, open in editor or on GitHub, remove worktree, delete it, copy a resume command).

**Tickets** are the roadmap surface: a cross-project list with client-side faceted filtering (text, priority/effort/uncertainty buckets or ranges, topics, planning stage, project, locally-written-only), sorting, and a group-by-project toggle — the whole view mirrored to the URL so it can be shared. Each ticket row leads with a start button that spins up an unattended agent implementing that one ticket, and shows whether a plan exists: a link to a page rendering the plan when it does, a button that starts an agent to write one when it doesn't. Queueing a ticket into the AI queue happens from the ticket's own page.

**Settings** covers appearance, driver and model defaults, the options every new agent starts with, saved devices, notification channels, automation (the idle sweep and the spend slider), and the cloud-session bridge token.

## Rationales

- What the dashboard reads out of the rest of the package comes from that package's *source*, not its build output; nearly all of it is type-only and reaches no bundle, and the little that is runtime code is compiled into the bundle like any other file. Reading the build instead would type-check the browser against the last build rather than the current source, and a fresh clone would not type-check until a build had run.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
