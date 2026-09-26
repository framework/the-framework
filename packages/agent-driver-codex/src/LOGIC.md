Codex as a driver [1] of the `agent-driver` contract, on this machine, and the package's entry point.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.

## Business logic — TL;DR

- **Codex on this machine** (`codex.ts`, `codex.test.ts`) - one non-interactive `codex` invocation per turn, sandboxed to the directory, framing ahead of the prompt, the last message as the answer, tokens without a price, its conversation resumed by thread id when a turn asks to continue, and no quota; each part of the person's own setup that is off turned into Codex's own switches, the skills through a kept Codex home holding only a link to the person's login; the readiness check with Codex's login question and the warning for `~/.agents/skills`, which no switch keeps out.
- **The entry point** (`index.ts`) - the Codex driver with its session, parser and option types, its readiness check, and where its kept Codex home is by default.
