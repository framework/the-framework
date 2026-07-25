priority: low
topics: [the-framework]

# [The Framework] Bootstrap mode

## TLDR

A "Create new project" button in the dashboard that starts a project from a single question — "What do you want to build?" — accepting anything from a vague hunch to a concrete plan, then co-creating a plan before any code is written. Prototyping showed the analyze-first behavior only sticks when the intent is worded as explicit instructions; the chosen approach is wrapping the user prompt (`wrapBootstrapPrompt()`, #458) rather than replacing Claude Code's system prompt. Build split into #448 (bootstrap prompt), #449 (create-empty-project daemon path), #450 (dashboard entry).

## Why it matters

Bootstrap mode is the zero-to-project entry point of the framework: it decouples what the AI *thinks* it should build from what will actually be built next (an anti-laziness gate — plan, show, await before scaffolding). Marked low priority because it's unproven how well it works in practice; real behavioral runs are still to be done.

## Source

Imported from GitHub issue [gemstack-land/the-framework#297](https://github.com/gemstack-land/the-framework/issues/297), created 2026-07-07, labels: `priority: low`, `the-framework ♻️`, 6 comments.

### Original description

In the dashboard, there's a button "Create new project".

Then it all starts with one question/prompt:

"What do you want to build?"

Label: "You can describe what you want approximately (e.g. just a hunch, just a vision, just an idea) and we'll create a plan together. Or you can go ahead with a concrete plan."

Low-prio for now I think (because I ain't sure how well we can make it work, to be tested).

### Notes from the GitHub thread

- The candidate system prompt (analyze → interpretations/PLAN.md → SHOW_IT → AWAIT; autopilot auto-accepts AWAIT after 10s) was tried on real sessions (Fable + Opus) and judged "quite effective".
- Prototype finding: appended soft instructions lose to Claude Code's default "be decisive" push; a full system-prompt replacement or a hard-override wording works. Maintainer direction: keep treating Claude Code as a black box — wrap the *user prompt* into instructions instead of using `--system-prompt`/`--append-system-prompt`.
- Follow-up issues filed: #448 (bootstrap prompt override block, highest-signal), #449 (create-empty-project daemon path), #450 (dashboard "Create new project" entry, depends on the other two). #458 switched the implementation to `wrapBootstrapPrompt()`.
