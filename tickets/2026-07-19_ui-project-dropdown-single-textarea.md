topics: [ux]

# UI: remove project list + every page includes a single textarea

## TLDR

Two UI directions: (1) replace the left-most project-list sidebar with a project dropdown in the sticky top nav (always shown, filters runs and the overview, multi-select; post-MVP: topics = collections of projects); (2) converge on a single textarea per page — one on the dashboard to start runs, one on the run page to resume the session (claude.ai/code / chatgpt.com convention, with a `New session` button rather than reinventing the wheel). **MVP cut**: remove the recently-added top-nav textarea, add a `New session` button, and a simple single-select project dropdown.

## Why it matters

This sets the dashboard's core interaction model on the de-facto standard users already know. The long-term idea is bigger than layout: every page's textarea makes the current page mere context for the AI (e.g. in settings, the AI gets the settings list + MCP access to change them), with auto project selection from the prompt. The permanent "Ask a question, or start a new session" textarea is liked but postponed as complex/unconventional.

## Source

Imported from GitHub issue [gemstack-land/the-framework#772](https://github.com/gemstack-land/the-framework/issues/772), created 2026-07-19, label: `UX ✨`, 2 comments.

### Original description

## Replace project list with project dropdown

- How about we remove the left-most sidebar that lists all projects? Instead of we show a project dropdown to filter the list of runs.
- I sugggest we show the project dropdown in the sticky top nav
- The project dropdown is always shown, including the overview page
- The project dropdown also filters the overview page
- Multiple projects can be selected
- Future (post-MVP): user can create topics => a collection of projects

## Always a single textarea

- Dashboard: show a single textarea (to start new runs)
  - Future (post-MVP):
    - For one-shot replies, don't switch to the run page and, instead, the agent replies inside the dashboard page (e.g. as a `<div>` above the textarea).
    - Auto project selection: depending on the user prompt, the agent automatically selects the right project (if ambigious, agent replies "On what project do you want me to work on this?")
- One textarea in the run page to resume the session
  - Same as https://claude.ai/code or https://chatgpt.com/
  - To create a new run, I suggest a new button `New session` (like https://claude.ai/code or https://chatgpt.com/) — I suggest we use the de-facto standard instead of re-inventing the wheel (otherwise it's confusing for users)
- In the future (post-MVP), we could even add a textarea in other pages (e.g. setting page). The idea here is that current page is basically just extra context for AI (e.g. in the settings page, the AI will be fed with the exhaustive list of settings, with MCP access to change settings).

## MVP

As always, MVP shortcuts welcome.

My MVP suggestion:
- We just remove the textarea we added yesterday in the sticky top nav, and we just add a new `New session` button. (So no textarea in the dashboard page for now.)
- A simple dropdown to select *one* project (no multi project selection for now)

### Notes from the GitHub thread

- "I still very much like the idea of having one permanent textarea 'Ask a question, or start a new session', but it's a bit complex and unconventional so I'd say let's postpone for now." The `MVP` section was added to the OP afterwards.
