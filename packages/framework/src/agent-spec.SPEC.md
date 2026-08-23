How the daemon tells a freshly spawned agent what to do: everything about the agent — the prompt, what kind of task it is, which checkout it runs in, its agent id and all the launcher's options — is written to a one-shot file that the agent reads and deletes as it starts.

## Business logic — TL;DR

- **One handoff file, not a command line** - the whole agent description travels as one structured file, so the daemon's way of starting an agent is not tied to what a human types on the command line.
- **A spec is consumed, never left behind** - the agent reads its spec and deletes it immediately, and the daemon cleans up a spec whose agent never started, so no prompt or device token is left sitting on disk.
- **Cleanup only removes what the framework itself created** - a spec's own directory is removed whole only when the framework verifiably made it; anything else has only the named file removed.
- **A file that is not a spec is refused** - a spec missing its prompt, its checkout or its kind fails immediately with a message naming the path.

## Business logic

### One handoff file, not a command line

#### User story

The user starts an agent from the dashboard, choosing a prompt, a preset or research, plus whatever the options gear and Settings say. Everything they chose has to reach the agent that gets spawned.

#### Business logic

An agent's full description — what it is asked to do, whether it builds from an intent, runs one prompt verbatim or runs the research preset, the checkout it runs in (a worktree, or the project itself), the agent id its worktree is named with, whether it reopens an existing agent's event log instead of starting a fresh one, and every option the launcher decided — is written to a single structured file. The daemon then spawns the agent pointed at that file's path.

An agent that continues an existing agent reopens that agent's event log rather than truncating it, because the follow-up *is* that same agent.

A file is used rather than a pipe: the agent is spawned detached with its output channels closed, so there is no channel to inherit, and a path survives the spawn without either side waiting on the other.

#### Rationale

This used to be twenty-seven command-line flags, which made the daemon's way of talking to an agent and the CLI's human surface the same thing. That forced the flags to be mutually validated, documented in a 140-line help text, and tri-stated — both `--auto-open-pr` and `--no-auto-open-pr` had to exist, because a command line can only say "present" or "absent", never "false". A structured file can say false, so none of that is needed, and the CLI is left with the handful of options a human actually types.

### A spec is consumed, never left behind

#### User story

An agent's spec holds the user's whole prompt and can name a device's access token. Neither may stay readable on disk once the agent has started.

#### Business logic

The agent reads its spec and deletes it in the same step — the handoff is one-shot. The daemon also removes the spec itself when the agent never consumed it: the spawn failed outright, or the agent died before reading it. Removing a spec an agent has already consumed does nothing, so both sides can always try.

### Cleanup only removes what the framework itself created

#### User story

A user hands the framework a spec file they wrote themselves, in a directory of their own. Starting that agent must not delete their directory.

#### Business logic

Each spec the daemon writes gets its own fresh directory, and cleanup removes that directory whole — otherwise every agent would leave one empty directory behind forever. A directory is removed whole only when the framework verifiably made it: it must carry the framework's own directory-name prefix *and* sit directly in the configured spec home. Anything else — a hand-written spec, or a user's own directory that merely happens to be named like the framework's — has only the named file removed, never the directory around it.

### A file that is not a spec is refused

#### User story

A user points the framework at a path that is not an agent spec.

#### Business logic

A spec must state the prompt, the checkout and the kind of task; the prompt may be empty only because research has its own default. When any of these is missing the agent refuses to start with a message naming the offending path. Options left unstated fall back to none.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
