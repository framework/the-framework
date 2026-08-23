What The Framework knows about each driver before running it — how the coding-agent CLI is called, what to tell the user when it is missing, and how to ask it whether the user is logged in — plus turning the picked driver name into the live driver that will do the work.

## Business logic — TL;DR

- **A profile per driver** - Claude Code and Codex each carry their display name, the CLI binary looked up on PATH (`claude`, `codex`), the hint shown when that binary cannot be found, the command that reports login state, and the one command that fixes being logged out.
- **Login is read from what the CLI says, never from whether it succeeded** - each driver reads its own CLI's answer, and unrecognised output means "could not say" rather than "logged out".
- **A driver name becomes a running driver in one place** - the picked driver decides which coding-agent CLI is driven; Claude-Code-only options are silently inapplicable to Codex.

## Business logic

### A profile per driver

#### User story

Before starting an agent, the user must have the chosen coding-agent CLI installed and logged in on their own subscription — The Framework never uses an API key of its own. Preflight tells the user exactly what is missing and the exact command that fixes it.

#### Business logic

Each driver is described by: how to name it in a sentence ("Claude Code", "Codex"), the CLI binary preflight resolves on PATH, an install hint naming the binary and its official install page, the arguments that make the CLI report its login state (`auth status` for Claude Code, `login status` for Codex), and the single command that logs the user back in (`claude auth login`, `codex login`).

### Login is read from what the CLI says, never from whether it succeeded

#### User story

A logged-out coding-agent CLI produces an agent that silently does nothing, so preflight must catch it. But a wrong "you are logged out" blocks a setup that actually works.

#### Business logic

Whether the CLI exited successfully does not decide the answer; the driver reads the answer out of the CLI's own output. Claude Code prints its login state as JSON and is read from that flag. Codex answers in a sentence, and the negative wording is tested before the positive because the positive is contained in it. Any output neither driver can interpret — including an older CLI that prints its usage text instead of an answer — comes back as "could not say", which never fails preflight. Only a CLI that explicitly says it is logged out does.

#### Rationale

The asymmetry is deliberate: a false "logged out" is worse than the silent dead agent this check exists to prevent, so uncertainty always resolves in the user's favour.

### A driver name becomes a running driver in one place

#### User story

The user picks Claude Code or Codex per agent; everything downstream just drives whatever was picked.

#### Business logic

The picked driver name is turned into the live driver at a single point. Options that only Claude Code understands — its permission mode and the MCP configuration behind the browser preview — are not passed to Codex, which has its own sandbox flag and no such configuration. They are dropped here and reported where the agent was started, so a flag that cannot apply says so instead of appearing honoured.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
