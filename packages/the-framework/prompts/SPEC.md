Every word the framework says to a coding agent, authored as markdown: the built-in system prompt, the protocols agents answer back through, the preset task prompts, and the repo conventions they are taught.

## TLDR

- The system prompt wraps the user's prompt in a working discipline: analyze it and gate on ambiguity or large scope, name the session and do all work on a branch of that name, offer alternatives wherever the best solution is unclear, and signal ready-for-merge only when nothing is left — without that signal the work is never merged.
- The protocols define the agent's side of the conversation: how to park on a gate (a choice, a multi-select, a document approval, handing the browser to a human at a login wall) and how to emit the non-blocking signals (show a document, name the session, ready-for-merge); per-capability protocols adapt it — a session with a real browser is told when to use it, a hands-off session is told gates can never be answered, so assume the recommended option and carry on.
- The presets are the one-click task prompts behind the dashboard's buttons: research, the quality reviews (readability, maintainability, security, UX), ticket triage and planning, and draining the queue.
- The format docs teach the repo conventions: tickets as dated proposal files with plan and claim siblings, and the priority-ordered queue file of confirmed work.
- The before-mergeable prompt is the final quality turn: queue follow-up refactor and security passes when the changes warrant them, and fold what the session learned into the project's knowledge base.

## Rationales

- Prompting lives as prose and is compiled into the code at build time, so a prompt change lands as a readable markdown diff that gets a review round like any other product change; the system prompt itself is designed and reviewed on a dedicated issue — changed there first, then synced here, with a drift check enforcing the sync.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
