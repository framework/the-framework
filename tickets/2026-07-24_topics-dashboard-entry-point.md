priority: medium
topics: [enhancement, the-framework, ux]

# Topics: dashboard entry point and project-less addressing

## TLDR

Part of #1115: surface topics in the dashboard and make the run views work without a project id, then move a topic under its project once it binds. Scope: a project-less addressing scheme (today everything routes by `/{projectId}/{runId}` — Overview, sidebar, the "gone" pane, every read through `resolveProjectPath`), an entry point for the "just start typing" path (complementing manual add-a-project, both stay), and settling the user-facing name for "Topics".

## Why it matters

This is the UX surface that makes project-less conversations real for users — without it, the underlying project-less-start and re-home mechanics have no front door. It's also the onboarding win: a user with zero projects gets a working first interaction.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1124](https://github.com/gemstack-land/the-framework/issues/1124), created 2026-07-24, labels: `enhancement`, `priority: medium`, `the-framework ♻️`, `UX ✨`.

### Original description

Part of #1115.

## What

Surface topics in the dashboard and make the run views work without a project id, then move a topic under its project once it binds.

## Scope

- **Project-less addressing.** Runs are addressed by project id everywhere today: URL routing `/{projectId}/{runId}`, the Overview and sidebar, the "gone" pane, and every read resolving through `resolveProjectPath`. A topic needs an addressing scheme that holds until it binds.
- **Entry point.** A way to start a topic (the "just start typing" path for a user with zero projects), complementing the existing manual add-a-project path. Both paths stay, they are complementary.
- **Naming.** Settle the user-facing word for "Topics".

## Depends on

The project-less start and re-home slices; this is the UX surface over them.
