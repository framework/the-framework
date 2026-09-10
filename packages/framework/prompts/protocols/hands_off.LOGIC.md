The section added only for a hands-off [2] agent [1], one whose work leaves this machine for a cloud session [3]: since no machine sees that session's working copy and nothing follows it to the end, the agent must land everything itself before it ends. The composition rule in `src/system-prompt.ts` places it after the await protocol and before the signal protocol, so a cloud session's gates work like a local agent's while the signal protocol stays last.

## Context

**User story**: the user hands a task to a cloud session and walks away; what comes back is a pull request, or committed files holding the analysis, the plan or the decision the task asked for, never a result that exists only inside the conversation on claude.ai.

**Problem**: a local agent's checkout stays on the machine, so The Framework itself pushes the branch and opens the pull request when the agent ends; a cloud session's working copy is out of reach, so anything the agent leaves uncommitted, or writes only into the conversation or into an ignored file, reaches nobody.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[3] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **Commit and open a pull request before ending** - the agent is told, under the heading "This session runs detached — land everything", that it was handed to a remote service, so before ending it commits its work on its branch and opens a pull request for it.
- **A deliverable that is not code is still committed** - an analysis, a plan or a decision is written into committed files, because a result living only in the conversation or in an ignored file reaches nobody.
- **No pull request only when no change was needed** - the agent ends without a pull request only when the task genuinely required no repository change, and then says so explicitly in its final message.
