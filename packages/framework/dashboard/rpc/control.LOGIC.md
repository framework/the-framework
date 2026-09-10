The browser's typed stubs for every action the dashboard takes on an agent [1], a project or the Claude web bridge [2]: one stub per action the daemon carries out, addressed by the action's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signature for that action, taken from `src/dashboard-rpc/control.ts`. An action the daemon renames, or whose arguments or answer change shape, therefore fails the dashboard's type check instead of breaking a button at runtime. The stubs add no rule of their own: what each action validates, refuses and answers is the daemon's logic, described beside `src/dashboard-rpc/control.ts`; only the actions' names and types cross into the dashboard, and none of the daemon's code reaches the browser bundle.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] the Claude web bridge: The daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge browser is the Chrome for Testing the daemon runs for it.
[3] gate: A question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[4] pick: The answer to a gate: the option or options chosen, by the user or automatically.
[5] live chat: The user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[6] handoff: What happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[7] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[8] cloud session: A Claude Code cloud session on claude.ai, the far end of a `web` agent.
[9] build agent / prompt agent: The two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[10] launcher: the Start form on a project's own page (the project home).
[11] agent id: An agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[12] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[13] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[14] claim: A ticket's lock file naming the holder working it, so two agents never work the same ticket.

## Business logic — TL;DR

- **Typed against the daemon** - each stub's arguments and answer are the daemon's own for that action, so an action renamed or re-shaped on the daemon's side is a type error in the dashboard's build, never a button that fails in the browser; the daemon's implementation is imported for its types only and stays out of the bundle.
- **Steering a running agent** - stop the agent [1], answer the gate [3] it is parked on with a pick [4], send it a live chat [5] message, and move its handoff [6] to one of its four rungs; each is one line the daemon appends to the agent's control file [7], and the call answers nothing.
- **The bridge** - queue the pick for the question a cloud session [8] is parked on, as labels of that question, and withdraw it while it is still queued; and show, hide or restart the bridge browser [2].
- **Starting an agent** - start a build agent [9], a prompt agent or a research agent with the launcher's [10] options, and learn whether it started (with its agent id [11] when it got a checkout [12] of its own), was refused because the same work is already active, or failed and why.
- **Landing an ended agent's work** - push the agent's branch, open a pull request for it, or merge it, each answering success, the pull request's number and URL, or the reason it was refused; a merge asked of an agent still running is an authorization the agent honors at its own end.
- **Removing what an agent left** - remove the checkout an ended agent kept, or delete the agent together with its records; both are refused while the agent is going, and a removal never destroys work that is not on the remote.
- **Opening a checkout in an app** - open the project's checkout, or one agent's, in the file manager or in the user's editor.
- **Tickets and the agent queue** - put a ticket, or a ticket's plan, on the agent queue [13] in the section its priority earns, and release the claim [14] an agent left on a ticket.
