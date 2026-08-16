The dashboard UI: a browser app served by the daemon that renders everything the daemon knows and steers sessions through it — holding no authoritative state of its own.

## TLDR

- Every read is a projection of state the daemon assembles (session logs, tickets, the queue, git and GitHub state, preferences); every write is a call into the daemon. The one exception is saved remote devices: their access tokens stay in this browser only, handed to the daemon per call.
- The URL is the selection: the overview at `/`, a project at `/{projectId}`, one session at `/{projectId}/{sessionId}`, plus cross-project tickets, a per-ticket page and its plan page, and settings. A session is a link you can paste, reload, and bookmark — there is no selection state to disagree with the address bar.
- A session's events stream live over one channel bound to that session's own log; everything else polls. A finished session reads from the archive instead, catching up whenever the live channel outgrew it.
- It is a plain client-side bundle: one static page the daemon serves for every address, and all the behaviour in the browser. There is no server rendering and no framework between the HTML and the app.
- Watch mode: opened against a shared relay link, the same app renders one session read-only.

## Flows

**The overview** is ordered by what governs what: the quota bar first (a week-track with pace and projection — the one figure that decides what agents may do next), then everything that needs *you* — the open-questions hub, every session's unanswered question across all projects, answerable right there in one scrolling view — then the agents working now, the full AI queue of every project (uncollapsed: a plan you cannot read is not a plan), routine work, and the hottest tickets. An onboarding checklist sits on top until dismissed; each step's "done" is derived from a real fact (a registered project, a ticket on disk, a granted permission, stored credentials), so a step cannot be ticked by clicking it and work done outside the dashboard shows up ticked anyway.

**The composer** starts and steers sessions. Typing a prompt starts an attended build session; picking a preset starts an unattended one. In-editor triggers pull in presets and actions, files, projects, and macro tags; option menus write straight to the user's or project's preferences. Pre-flight checks warn before the session is spent — a missing or logged-out GitHub CLI, a repo that can't auto-merge. Inside a session, the composer is the session control: a live session takes messages (options are baked at spawn and hidden), a stopped one offers to resume with reduced options, and the submit slot doubles as Stop while the agent works.

**The session view** is a transcript with the controls inline: the agent's questions render as answerable cards exactly where they happened (resolved ones collapse to a checkmark), and the session's live browser screencast renders inline too, degrading to a last still when the session ends. Around the transcript: changed files with diffs, git status, the handoff panel (push, open PR, merge), agent-authored views, docs, and history rails, and an actions menu (stop, serve/preview, open in editor or on GitHub, remove worktree, delete session, copy a resume command, copy a shareable watch link).

**Tickets** are the roadmap surface: a cross-project list with client-side faceted filtering (text, priority/effort/uncertainty buckets or ranges, topics, planning stage, project), sorting, and a group-by-project toggle — the whole view mirrored to the URL so it can be shared. Each ticket row leads with a start button that spins up an unattended agent implementing that one ticket, and shows whether a plan exists: a link to a page rendering the plan when it does, a button that starts a session to write one when it doesn't. Queueing a ticket into the AI queue happens from the ticket's own page.

**Settings** covers appearance, agent and model defaults, run options, saved devices, eco mode, notification channels, automation (the idle sweep and the spend slider), and the cloud-session bridge token.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
