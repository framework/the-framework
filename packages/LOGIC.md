The deliverables The Framework ships, one directory each. The product is the `framework` package; every other package is either a library the product is built from — the driver [2] seam, a branch used as a file store, and the four skills [3] — or a companion: the Chrome extension of the Claude web bridge, and the marketing website.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[3] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`), a command on the agent's PATH, and an API the product calls.
[4] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[5] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.

## Business logic — TL;DR

- **The product** (`framework/`) - the `framework` npm package: the `the-framework` CLI, the daemon, the agent [1] lifecycle, the dashboard it serves, and every prompt an agent is sent. Depends on all six packages below.
- **The driver seam** (`agent-driver/`) - the `agent-driver` npm package: one contract for driving a coding agent as a black box, with the Claude Code, Codex, GitHub Actions and fake driver [2] implementations. The product adds its own cloud-session implementation behind the same contract. Depends on nothing else here.
- **A branch used as a file store** (`agent-data/`) - the `@gemstack/agent-data` npm package: the `agent-data` branch [4] every skill keeps its files on, checked out under `.branches/`, written through one sync → commit → push cycle, plus the git runner and the git-exclude rule that machinery is built on. A library, not a skill: read by code, never by an agent. Every skill depends on it; it depends on nothing.
- **The `branches` skill** (`skill-branches/`) - the `@gemstack/skill-branches` npm package: one checkout per agent under `.branches/`, named as its branch, reclaimed once its work is on the remote; the `branches` command and the skill [3] every agent reads. Depends on `agent-data`.
- **The `tickets` skill** (`skill-tickets/`) - the `@gemstack/skill-tickets` npm package: the project's tickets with their plans and claims on the `agent-data` branch, the `tickets` command that reads, writes, claims and closes them, and the skill text. Depends on `agent-data`.
- **The `queue` skill** (`skill-queue/`) - the `@gemstack/skill-queue` npm package: the agent queue on the `agent-data` branch, the `queue` command that reads it, adds an entry at a priority and takes one off, and the skill text. Depends on `agent-data`.
- **The `logs` skill** (`skill-logs/`) - the `@gemstack/skill-logs` npm package: the record of every run agents made on a project, on the `agent-data` branch, and the read-only `logs` command; the product writes every run through it. Depends on `agent-data`.
- **The Claude web bridge's extension** (`chrome-extension/`) - a Chrome extension, not an npm package: the far end of the Claude web bridge [5], reading claude.ai in a signed-in browser. Talks to the product over HTTP only.
- **The website** (`the-framework.ai/`) - the marketing site at https://the-framework.ai. Presents the product; shares no code with it.

No skill depends on another skill, and nothing but the product depends on a skill.
