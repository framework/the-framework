The agent spec [1]: the one JSON file the daemon writes for an agent [2] process it spawns, holding the whole configuration (the prompt, the kind, the checkout [3], the agent id [4], whether the process continues an existing agent, and every option the launcher [5] and Settings decided). The daemon writes it into a private directory of its own, the spawned process reads it once and removes it, and the daemon removes it itself when the process never ran, so a spec never outlives the start it described.

## Context

**User story**: the user presses Start in the launcher; the daemon spawns the agent's process with `the-framework --agent <path>` and nothing else on its command line. The CLI keeps its four options, and an agent's configuration is never also a human-facing flag surface.

**Problem**: the spawned process is detached with its standard streams closed, so there is no pipe to inherit; a file is the channel. The options may carry a device [6]'s token (an agent relayed [7] to another machine), which must not stay on disk once the agent has started.

## Glossary

[1] agent spec: the one JSON file the daemon hands a spawned agent process with its whole configuration.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[5] launcher: the Start form on the project home, a project's own page.
[6] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[7] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.

## Business logic — TL;DR

- **What a spec carries** - the prompt (empty allowed only for the research kind), the kind, the checkout, the agent id when the daemon minted one, whether the process continues an existing agent, and the agent's options.
- **One private directory per spec** - each spec is written as readable JSON into a fresh directory of its own under the spec home, so two starts never share a file and a process that dies can be diagnosed from what it was handed.
- **Reading consumes the spec** - the process reads the file once and removes it before using it, so a device token never outlives the start.
- **Only a directory The Framework verifiably made is removed whole** - the directory goes with the file only when it carries The Framework's prefix and sits directly in the spec home; a hand-written spec loses only the file.
- **A file that is not a spec is refused** - a missing prompt, checkout or kind, or content that does not parse, refuses the start rather than half-running it; missing options read as empty options.
- **Cleanup when the process never ran** - the spawner removes the spec when the spawn fails or the process dies before reading it, and removing an already consumed spec is a no-op.

## Business logic

### What a spec carries

#### Context

See `## Context`.

#### Business logic

A spec holds: the prompt, which may be empty only for the research kind, whose "what" has its own default; the kind, one of build (the opening prompt is composed around an intent), prompt (the text runs verbatim) and research (the research preset is rendered around the text); the checkout [3] the agent runs in, a worktree of the project or the project itself; the agent id [4] when the daemon named the checkout by it, so the directory and the agent recorded inside it are one string; whether the process continues an existing agent, in which case it reopens that agent's log instead of starting a new one; and the options, everything the launcher [5]'s options gear and Settings decided about the agent.

### One private directory per spec

#### Context

**Problem**: two starts at the same moment must never read each other's spec, and an agent that dies at boot must be diagnosable from the spec it was handed.

#### Business logic

Every spec is written as indented, human-readable JSON named `session.json` inside a freshly created directory of its own, prefixed `framework-session-`, under the spec home. The spec home is the operating system's temporary directory unless the environment names another (tests do). The path of the file is what the spawned process is given.

### Reading consumes the spec

#### Context

**Problem**: the options can name a device [6] token, which has no business staying on disk after the agent that used it has started.

#### Business logic

Reading a spec reads the file and removes it before its content is parsed or checked, so the file is gone whether or not it turns out to be a valid spec. Reading is a one-shot handoff: a spec is never read twice.

### Only a directory The Framework verifiably made is removed whole

#### Context

**Problem**: `--agent <path>` accepts any path. A spec the user wrote by hand, or a directory of the user's that happens to be named like The Framework's, must never be taken with the file.

#### Business logic

When a spec is removed, its whole directory goes with it only when both hold: the directory's name starts with `framework-session-`, and its parent is exactly the spec home. Otherwise only the file is removed, and the directory survives with anything else in it. Removing what is already gone is not an error.

### A file that is not a spec is refused

#### Context

**User story**: an agent started on a broken spec fails at once with "could not read the session spec", never as an agent running with half its configuration.

#### Business logic

A spec must have a prompt that is a string, a checkout path that is a string, and a kind; otherwise it is refused with "<path> is not a session spec". Content that is not JSON, or a path that does not exist, is refused too. A spec without options reads as one with empty options, never as one with none.

### Cleanup when the process never ran

#### Context

**Problem**: a spawn that fails outright, or a process that dies before reading its spec, leaves the whole prompt (and any device token) sitting on disk.

#### Business logic

The spawner removes the spec, directory and all, when the process could not be spawned, and again when the process exits; for a process that consumed its spec that removal is a no-op. The daemon also removes a spec it wrote for a start it then refuses because it is shutting down.
