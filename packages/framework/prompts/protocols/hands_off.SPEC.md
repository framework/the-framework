Told to every hands-off agent: this agent was handed somewhere no machine here sees its workspace, so everything it produces has to land in the repository as a pull request rather than in a conversation nobody will read.

## User story

- The user hands a task to a cloud session and closes the dashboard. Their only view of that work is what comes back as a pull request.
- Analysis that stayed in the remote conversation, or in a file that was never committed, is analysis the user never sees.

## Business logic — TL;DR

- **The session runs detached** - the agent is told plainly that no machine sees its workspace and nothing here follows it to the end — and that the `branch-management` command is not there, so it creates and checks out its `tf-<session name>` branch with git itself.
- **Land everything** - before ending, the agent commits its work on its agent branch and opens a pull request for it.
- **A non-code deliverable is committed too** - analysis, a plan or a decision is written into committed files, because a result living only in the conversation or in a gitignored file reaches nobody.
- **No pull request is the exception, and must be said** - the agent ends without one only when the task genuinely required no repository change, and states that explicitly in its final message.

## Business logic

### Land everything

#### User story

See `## User story`: the pull request is the only channel back to the user.

#### Business logic

The prompt tells the agent that its session runs detached — it was handed to a remote service, no machine sees its workspace, and nothing here follows it to the end. The `branch-management` command the built-in prompt's session-name step names is not there either, so the agent creates and checks out the branch `tf-<session name>` with git itself. Before ending, it must commit its work on that branch and open a pull request for it.

When the deliverable is analysis, a plan, or a decision rather than code, the agent writes that into committed files: the prompt states plainly that a result living only in this conversation, or in a gitignored file, reaches nobody.

Ending without a pull request is allowed only when the task genuinely required no repository change, and the agent must say so explicitly in its final message.

#### Rationale

This is the whole of what a hands-off agent is told about being detached. Its gates are the same as any agent's: whether a question it stops on reaches the user is the Claude web bridge's business, not this prompt's.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
