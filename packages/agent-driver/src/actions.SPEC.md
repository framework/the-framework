The driver for the `actions` run target: instead of running the coding-agent CLI on this device, it hands each turn to a GitHub Actions runner — dispatch the project's agent workflow, wait for the run to finish, then read back the transcript the run uploaded. To the caller this looks exactly like any other driver; only the tempo differs.

## User story

The user wants an agent to work a task without tying up their own machine — the laptop can sleep, and the work happens on GitHub's runners against the repo's own subscription token.

## Business logic — TL;DR

- **One turn is one workflow run** - every prompt dispatches the workflow the caller names, on a fresh runner with a fresh checkout; nothing survives on the runner between turns.
- **The pushed branch is the continuity** - each run pushes to one branch that stays the same for the whole agent, and the next turn is dispatched from it, so later turns build on earlier work.
- **A correlation id finds the run** - GitHub's dispatch reports no run identifier, so a unique per-turn tag is echoed into the run's name and its uploaded artifact and matched on.
- **The transcript replays in a burst** - there is no live stream from a runner; the whole turn's events arrive at once when the run completes.
- **Code is read from the branch, not from disk** - the runner is gone by the time anything is read, so file reads go to the pushed branch over GitHub's API.
- **Values that reach the runner's shell are restricted** - the model name and the resumed session id must be plain identifiers or the turn is refused.
- **No quota reporting** - this driver never reports where the subscription stands.

## Business logic

### One turn is one workflow run

#### User story

See `## User story`.

#### Business logic

Each prompt dispatches the workflow the caller named when it configured the driver — one that echoes the correlation id into its run name and uploads the transcript — with the prompt text, then polls until that run completes. A run that concludes as anything other than success fails the turn and reports the run's URL. The wait gives up after an hour by default — GitHub's own job cap is six — and the user pressing Stop, at either the agent level or for the single turn, ends the wait immediately.

The system prompt framing is prepended to the prompt text rather than passed as a separate input.

#### Rationale

The prompt travels as a workflow input, which the action passes to the CLI verbatim, so multi-line text is safe. A separate system-prompt flag would have to survive shell quoting inside the workflow, which is an injection seam not worth opening for framing text.

### The pushed branch is the continuity

#### User story

See `## User story`.

#### Business logic

The agent's session picks one branch name up front — `claude/<session id>` unless the caller sets another prefix — and asks every run to push to it. The first turn runs on the project's default ref; once a run reports the branch it pushed, every later turn is dispatched from that branch, so the runner's fresh checkout already contains the previous turns' work. The agent's own session id is carried across turns as well, so a turn can resume the CLI's conversation rather than starting cold.

#### Rationale

The branch is named by the driver and handed to the workflow rather than discovered afterwards, because a dispatched run reports no branch name of its own — there would be nothing to discover.

### A correlation id finds the run

#### User story

See `## User story`.

#### Business logic

Dispatching a workflow returns no identifier for the run it creates. Each turn therefore carries a correlation id that the workflow writes into the run's display name and into the name of the artifact it uploads; polling matches recent dispatched runs on that id. The id mixes a random tag with a per-turn counter, so two agents — or the same agent after the calling process restarts — never match each other's runs.

### The transcript replays in a burst

#### User story

The caller's UI shows an agent's tool calls and messages as an event stream, the same way for every run target.

#### Business logic

When the run completes, its uploaded artifact is downloaded and unpacked. The transcript file inside it holds exactly the same messages the CLI would have emitted line by line locally, so it is replayed through the same reader and produces the same events, the same final message, the same session id, and the same usage figures. The only difference the user sees is timing: the events all arrive at once at the end of the turn instead of trickling in.

An artifact with no transcript file fails the turn and says so, naming what the artifact did contain. The artifact's second file records the branch the run pushed; if it is unreadable the turn still succeeds and only reading files from the branch is lost.

### Code is read from the branch, not from disk

#### User story

The caller reads files the agent produced — its plan, its notes, its config — as part of a turn's follow-up.

#### Business logic

Reading a file goes to the pushed branch through GitHub's contents API, because the runner's workspace no longer exists once the run has ended. Before any run has pushed a branch, reading a file reports that plainly rather than returning empty content.

### Values that reach the runner's shell are restricted

#### User story

See `## User story`.

#### Business logic

The model name and the resumed session id are passed into the workflow and end up as environment variables on the runner. Both must consist only of letters, digits, and `.`, `_`, `:`, `-`; anything else refuses the turn instead of dispatching it. Both values are identifiers in normal operation, so a rejection means either a bug or an attempt at injection.

### No quota reporting

#### User story

The caller's UI shows how much of the account's quota week is left, so unattended work can stand down near the quota boundary.

#### Business logic

This driver reports no quota at all. The subscription being drawn down belongs to whichever account's token the repository holds, not to this device, and there is no runner left alive to ask.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
