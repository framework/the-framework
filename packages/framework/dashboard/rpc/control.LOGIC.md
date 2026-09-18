The browser's typed stubs for every action the dashboard takes on an agent [1], a project or the Claude web bridge [2]: one stub per action the daemon carries out, addressed by the action's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signature for that action, taken from `src/dashboard-rpc/control.ts`. An action the daemon renames, or whose arguments or answer change shape, therefore fails the dashboard's type check instead of breaking a button at runtime. The stubs add no rule of their own: what each action validates, refuses and answers is the daemon's logic, described beside `src/dashboard-rpc/control.ts`; only the actions' names and types cross into the dashboard, and none of the daemon's code reaches the browser bundle.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge browser is the Chrome for Testing the daemon runs for it.
[3] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, and the answer resumes it.
[4] pick: the answer to a gate: the option or options the user chose.
[5] message: the user's own words to an agent, the next prompt of the same conversation.
[6] inbox: the file in a working agent's checkout where what the user says waits until the agent's turn ends.
[7] resume hook: the one shell line under `resume:` in the project's `.the-framework/hooks.yml`, which continues an ended agent with the user's text or answer.
[8] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[9] start hook: the one shell line under `start:` in the project's `.the-framework/hooks.yml`, which starts an agent and answers its id.
[10] the user's picks: the coding agent and the model chosen in the preferences, and the device chosen in "Run on".
[11] agent id: an agent's stable id, answered by the start hook; it names the agent's checkout directory, its branch until the agent names it, and its record.
[12] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[13] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[14] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.

## Business logic — TL;DR

- **Typed against the daemon** - each stub's arguments and answer are the daemon's own for that action, so an action renamed or re-shaped on the daemon's side is a type error in the dashboard's build, never a button that fails in the browser; the daemon's implementation is imported for its types only and stays out of the bundle.
- **Saying something to an agent** - stop the agent [1]; answer the gate [3] it ended on with a pick [4]; send it a message [5]. A stop answers nothing. A pick and a message answer whether they went through or why not: the daemon puts them in the agent's inbox [6] while it works and continues an ended agent through the project's resume hook [7], and refuses in words when it cannot.
- **The bridge** - queue the pick for the question a cloud session [8] is parked on, as labels of that question, and withdraw it while it is still queued; and show, hide or restart the bridge browser [2].
- **Starting an agent** - start an agent with a prompt and the user's picks [10] through the project's start hook [9], and learn its agent id [11], or why it was not started.
- **Landing an ended agent's work** - open a pull request for the agent's branch, or merge the pull request it has, each answering success, the pull request's number and URL, or the reason it was refused; a merge asked of an agent still working is refused.
- **Removing what an agent left** - remove the checkout [12] an ended agent kept, or delete the agent together with its records; both are refused while the agent is going, and a removal never destroys work that is not on the remote.
- **Opening a checkout in an app** - open the project's checkout, or one agent's, in the file manager or in the user's editor.
- **Tickets and the agent queue** - put a ticket, or a ticket's plan, on the agent queue [13] in the section its priority earns, and release the claim [14] an agent left on a ticket.
