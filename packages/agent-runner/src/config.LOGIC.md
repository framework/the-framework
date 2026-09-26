This machine's settings for the tool: `.agent-runner/config.yml` in the project, read as a YAML map, and the `personal:` map in it, which says which parts of the person's own setup this machine's runs load. The `ended:` line (`ended.ts`) is read from the same file.

## Context

**User story**: the user wants their scheduled runs to do the same job on every machine, so by default a run's coding agent, Claude Code or Codex, leaves out the person's own setup (`runner.ts`). On a machine where they want part of it back, they write one line per part:

```yaml
personal:
  memory: on
  connectors: on
  skills: on
```

**Problem**: a config file the person broke must not stop a run, but the person should learn why the file was not used.

## Glossary

[1] part: one of the three pieces of the person's own setup a run's coding agent can load, each turned on by its own line under `personal:`: `memory` (what the coding agent remembers across sessions on its own: Claude Code's auto-memory, Codex's memories; not `~/.claude/CLAUDE.md`), `connectors` (the connectors of the person's claude.ai account; Codex's apps and plugins), `skills` (the person's own instructions, skills and settings files: for Claude Code their user settings, which carry the skills synced from their claude.ai account and settings such as the effort level, the model, hooks and a login through `apiKeyHelper` or an `env` entry, with `~/.claude/CLAUDE.md` and `~/.claude/skills`; for Codex `~/.codex/AGENTS.md`, `~/.codex/skills` and `~/.codex/config.toml`, with any model provider or login set there). For Codex, `memory` comes back only with `skills` on too, since Codex keeps its memories in the person's own Codex home. The part names are the `agent-driver` contract's, so every coding agent's driver takes the same three.

## Business logic — TL;DR

- **Reading the file** - no file is no settings, silently; a file YAML cannot parse, or one whose top is not a YAML map, is no settings and one line on the log.
- **`personal:`** - a map with one line per part [1]; a part is on for `on` or YAML true, off otherwise; a part that is neither on nor off, an unknown part, and a `personal` that is not a map are each one line on the log and turn nothing on.

## Business logic

### Reading the file

#### Context

The file sits in the tool's directory `.agent-runner/`, which the tool hides from git, so it is this machine's, for this project. Only a person writes it.

#### Business logic

The file is read each time a setting is asked for (a run asks for `personal` when it starts or resumes, and for the `ended:` line when it ends), so a change counts from the next read on, and a broken file is said on the log at each read: once when the run starts, and again for each end the `ended:` line is read for (a run with a follow-up can have two). No file, or one that cannot be read, is no settings and nothing is said; so is an empty file. A file YAML cannot parse is no settings, and the log gets `[agent-runner] <the file>: <the parser's first line>`. A file whose top is not a YAML map (a list, a string, a number) is no settings, and the log gets `[agent-runner] <the file>: the file is not a YAML map`.

### `personal:`

#### Context

See `runner.ts`, "The person's own setup, left out": each part [1] turned on here is loaded by a run's coding agent, Claude Code or Codex.

#### Business logic

Every part [1] starts off. No `personal` key, or `personal:` with no value, leaves all three off, silently. A `personal` that is not a map (`personal: on`, a list) leaves all three off, and the log gets `[agent-runner] <the file>: \`personal\` is not a map of memory, connectors, skills`. In the map, a part is on for `on` or any value YAML reads as true (`true`, `True`, `TRUE`); the word `on` must be lower case. A part stays off, silently, for `off`, any value YAML reads as false, or no value. Any other value (`On`, `yes`) leaves that part off, and the log gets `[agent-runner] <the file>: \`personal.<part>\` is not on or off`. Part names are lower case like the values. A key that is not a part (`plugins`, `Memory`), whatever its value, turns nothing on, and the log gets `[agent-runner] <the file>: \`personal\` has no part \`<key>\`; the parts are memory, connectors, skills`. A part with no line stays off.
