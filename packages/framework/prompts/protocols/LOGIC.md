The four sections appended to an agent's [1] system channel after the built-in system prompt and the project's `SYSTEM.md`: the two protocols that pin the exact syntax of everything The Framework reads off a turn's [2] final message, which every agent receives, vanilla [3] ones included, and the two sections an agent receives only in a given situation, a browser attached or its work leaving the machine. Their order is fixed by the composition rule in `src/system-prompt.ts`: the browser section, the await protocol, the hands-off section, and the signal protocol last. A transparent agent receives none of them.

## Context

**Business logic story**: the coding agent runs a turn [2] as a black box, so a gate [4], a view [5], the ready-for-merge [6] signal, a pull request's title and body and a reported error all have to be fenced blocks in the final message that the rule in `src/turn-gate.ts` can parse. The built-in system prompt says when to do each of these things; the protocols only say how.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] vanilla: an agent started without the built-in system prompt but with the signal protocols kept. transparent: an agent started with nothing of The Framework's, the raw coding agent.
[4] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[5] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[6] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[7] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.

## Business logic — TL;DR

- **A real browser** (`browser.md`) - only with a browser attached: the agent has a real Chrome through the `chrome-devtools` tools, uses it for what it must see or act on, fetches text when reading is enough, and navigates within one page so the user can watch.
- **Awaiting a choice** (`await.md`) - a question is one `await-choices` block ending the turn, with a recommended option safe to take unattended and a stop option for rejecting the work; a browser handover is the same block with "Handled it" and "Could not handle it"; a `show-markdown` block shows a document in the right rail without stopping.
- **Landing everything when hands-off** (`hands_off.md`) - only for a hands-off [7] agent: commit and open a pull request before ending, write non-code deliverables into committed files, and skip the pull request only when no repository change was needed, saying so.
- **Signaling without stopping** (`signal.md`) - an empty `ready-for-merge` block is the ready-for-merge [6] signal, an `open-pr` block written like a commit message names the pull request The Framework opens, and an `error` block reports what only the user can fix, each recorded once.
