priority: medium
topics: [enhancement, the-framework, ux]

# Topics: start a conversation without a project, bind to one lazily

## TLDR

Let a conversation start **without** selecting a git project/worktree: a "topic" starts from intent, and a project is created or picked lazily, only when the work actually touches code. Mechanism: the topic runs in a neutral cwd with no repo access; the agent gets `list_projects` and `create_project`, calling one *is* the bind and its confirmation prompt *is* the permission gate (asked once per new project, reusing the #439 trust gate + await/choice, autopilot-compatible). Both paths stay: manual up-front project adding and on-demand binding. Status: scope and plan before building; near-term UX work outranks it.

## Why it matters

More than convenience: you know *what* you want before *where* it lives; a zero-project newcomer can just start typing instead of hitting an "add a project first" dead-end; and some topics never need a repo (planning, drafting a ticket, questions). It's fundamentally a **permission-model** feature — the topic use-cases work regardless of how permission is granted, so the permission design stays separable. The one genuinely new engineering piece: a run must be able to re-home its cwd/worktree mid-session.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1115](https://github.com/gemstack-land/the-framework/issues/1115), created 2026-07-24, labels: `enhancement`, `priority: medium`, `the-framework ♻️`, `UX ✨`.

### Original description

## Idea

A conversation should be able to start **without** first selecting a git project or worktree. Today a prompt is boxed into a project and you must pick one up front. A "topic" instead starts from intent; a project/worktree is created or picked **lazily**, only when the work actually touches code.

## Why (more than convenience)

- Order of thinking: you know *what* you want before *where* it lives.
- Onboarding: a new user with zero projects can just start typing instead of hitting an "add a project first" dead-end.
- Some topics never need a repo at all (planning, drafting a ticket, a question).

## Proposed mechanism

- A topic starts project-less; the agent runs in a neutral cwd with no repo access.
- The agent gets two tools: `list_projects` (bind to an existing project) and `create_project` (register a new one). Calling one **is the bind**, and its confirmation prompt **is the permission gate**.
- Reuses the existing trust gate (#439) and the await/choice mechanism; must work with autopilot.
- Permission is asked **once per new project**.
- Support **both** paths, they are complementary: adding projects manually up front, and the agent asking to add one on demand.

## Open decisions (for the scoping plan)

- `create_project` needs a default directory. Proposal: a **"directory of repos"** with a setting — *auto-add and grant permission to every repo in it (dangerous, opt-in), otherwise ask per project.* This also contains the "the app suddenly has access outside known projects" concern to that one directory.
- Filesystem-access model (a desktop shell with user-permissioned filesystem is a longer-term option).
- The one genuinely new engineering piece: a run must be able to **re-home its cwd/worktree mid-session** (bind after start).
- Naming for "Topics".

## Notes

- This is fundamentally about the **permission model**. The topic use-cases (glance at the dashboard, ask about blocked issues, "create a project like X") can be implemented regardless of how permission is granted, so keep them out of the permission design.
- Prior art to check: how comparable tools separate a general chat from per-project chat.

## Status

Scope and plan before building. Near-term UX work is the higher priority.
