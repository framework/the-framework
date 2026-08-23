The launcher's "Start an agent" form: where the user writes a task for the selected project, narrows what the agent should look at, previews the system prompt it will get, and starts it — with every reason the agent could not succeed said before the start spends anything.

## User story

- The user wants to describe a task and hand it to an agent in the selected project.
- The user wants to point the agent at other registered repos or particular files, so it does not have to search for what the task is about.
- The user wants to see the whole system prompt the agent will actually receive, not a summary of it.
- The user wants a start that cannot work — a coding-agent CLI that is not logged in, a missing GitHub CLI on a run armed to open a pull request — to say so before a branch and a worktree are spent on an agent that dies before it exists.

## Business logic — TL;DR

- **One start per project** - starting goes through the daemon, which allows one agent per project at a time; being told one is already running is the busy answer.
- **A typed prompt and a fired preset end differently** - a prompt the user typed keeps the agent open for chat; a preset is fired work, so it runs unattended and ends when its work settles, with its armed handoff firing, exactly as it would if Auto PM had started it.
- **The started agent is shown at once** - the newly started agent is selected and appears in the agents list immediately, seeded from the typed text until the agent's own record catches up, and marked with the device it runs on when it is remote.
- **Context narrows the agent's focus** - the other registered repos and individual files can be ticked; the picks become the agent's stated context. The current project is never offered, since it is already the agent's workspace.
- **The prompt preview shows the real prompt** - the disclosure reads the very options the start will send, and includes the repo's own `SYSTEM.md`.
- **Pre-flight checks before anything is spent** - the driver's own readiness, the GitHub CLI when a pull request is armed, the model's known weakness, and how an armed merge will actually be performed.
- **Feedback where the button is** - the start's error or progress note sits with the Start button, and editing the prompt clears an error that described the previous attempt.

## Business logic

### One start per project, and how it ends

#### User story

See `## User story`.

#### Business logic

Submitting sends the prompt to the daemon, which enforces one agent per project; when one is already running, that is what comes back. The form is shown when no agent is active.

Which submit it was decides how the agent ends. Text the user typed starts an agent that stays open for chat. A preset is fired work: it starts unattended, meaning gates auto-answer, the agent ends when its work settles, and its armed handoff fires — the same way the routine behaves when Auto PM starts it.

On success the agent just started is selected, the composer is cleared, and the agent appears in the agents list right away, seeded from the typed text until its own record arrives a beat later. An agent running on a device carries that device's label, so its view can mark where it executes.

### Context narrows the agent's focus

#### User story

See `## User story`.

#### Business logic

An agent can reach every registered repo, so ticking a subset narrows what it focuses on. The context holds two kinds of entry: whole registered repos, and individual files picked from the project's file tree or mentioned in the prompt. Both are summarised as counts beside the picker ("2 projects · 3 files"), counted separately.

The project the agent runs in is never offered as a target, because it is already the agent's workspace; only the other registered repos are. Removing a file's mention from the prompt drops it from the context again.

The picked paths are handed to the agent as its stated context, and the same set is shared with the right-hand file tree, so the two always agree.

### The prompt preview shows the real prompt

#### User story

See `## User story`.

#### Business logic

A disclosure above the Start button shows the entire system prompt the agent will receive, including the workspace's own `SYSTEM.md`, which is read from the daemon rather than guessed at. It is rendered from the exact options this form will send, so it can never claim a smaller prompt than the agent gets. The disclosure also carries the two switches that change the prompt wholesale: dropping the built-in system prompt, and running the wrapped CLI fully raw.

### Pre-flight checks before anything is spent

#### User story

See `## User story`.

#### Business logic

Before the Start button is pressed, the form checks what would stop this particular agent and states each problem with its own fix, in red for a blocker and amber for a warning:

- Whether the picked driver's CLI can start an agent at all. This is only asked for an agent that runs on this machine — an agent on a GitHub Actions runner needs nothing local, and an agent on a device runs against that device's own installation. The answer is re-checked whenever the driver changes, since one CLI being logged in says nothing about the other.
- Whether the GitHub CLI is present and logged in, asked additionally when the agent's handoff is armed to reach a pull request or beyond, so a missing GitHub CLI is said now rather than hours later as a pull request that was silently never opened.
- When the model is Haiku, a warning that it consistently skips the finish protocol, so a publishing agent ends as an unmerged draft pull request and needs hand-holding — with the recommendation to pick a stronger model for real work. It never blocks the start.
- When the handoff is armed to merge and the repository has GitHub's auto-merge disabled, a note that the daemon's CI watch will merge the pull request once its checks pass — sound, but only while the dashboard is running — and how to set up the server-side version instead: enable "Allow auto-merge" in the repository settings and mark a check as required. This too never blocks. It is not asked for an agent on a device, which merges on its own device.

#### Rationale

Every one of these is a failure the user would otherwise learn about only after the agent existed — a branch and a worktree spent on an agent that dies immediately, or a finished agent whose work was never published. The rule is to teach rather than to block: only a genuine inability to start is red.

### Options the start actually uses

#### User story

See `## User story`.

#### Business logic

The agent's options come from the user's own preferences through the daemon's own mapping, read once so the submit and the prompt preview cannot describe different agents. When a device is picked as the run target, the agent additionally carries that device's relay target. A device's token is a per-browser secret: it rides along with the start in memory only and is never persisted.

### Feedback where the button is

#### User story

See `## User story`.

#### Business logic

The start's failure, and its "Starting…" progress note, appear directly beneath the composer rather than below the context disclosure, which can be tall enough to push them past the fold from the button that caused them. Editing the prompt after a failed start clears the error, since it described the previous attempt. Loading a preset says so, and when it replaced a draft it says that undo brings the draft back.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
