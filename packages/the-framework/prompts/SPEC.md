Every word the framework says to a coding agent, authored as markdown: the built-in system prompt, the protocols agents answer back through, the preset task prompts, and the repo conventions they are taught.

## Flows

- The system prompt wraps the user's prompt in a working discipline: analyze it and gate on ambiguity or large scope, keep every read and write under the working directory, name the session and do all work on a branch of that name, offer alternatives wherever the best solution is unclear, and signal ready-for-merge only when nothing is left — without that signal the work is never merged.
- The protocols define the agent's side of the conversation: how to park on a gate (a choice, a multi-select, a document approval, handing the browser to a human at a login wall) — including marking the answers that end the agent rather than resume it, so a rejection is not something it is asked to build on — and how to emit the non-blocking signals (show a document, name the session, ready-for-merge); per-capability protocols adapt it — an agent with a real browser is told when to use it, a hands-off agent is told gates can never be answered, so assume the recommended option and carry on.
- The presets are the one-click task prompts behind the dashboard's buttons: research, the quality reviews (readability, maintainability, security, UX), ticket triage and planning, and draining the queue.
- The format docs teach the repo conventions: tickets as dated proposal files with plan and claim siblings, and the priority-ordered queue file of confirmed work.
- The before-mergeable prompt is the final quality turn: queue follow-up refactor and security passes when the changes warrant them, and fold what the agent learned into the project's knowledge base.

## Rationales

- The workspace boundary is spelled out because the layout invites crossing it: an agent's worktree is nested inside the repo, so the user's own checkout is a path prefix of its working directory, and the same file exists twice. An agent that edits the outer copy while committing the inner one finishes clean with a commit holding none of its work.
- Prompting lives as prose and is compiled into the code at build time, so a prompt change lands as a readable markdown diff that gets a review round like any other product change. These files are the only source of truth: the compiled module is regenerated from them on every build, so there is no second home for the text to drift, and no checker needed to catch it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
