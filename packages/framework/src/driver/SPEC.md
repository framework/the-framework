The Framework's own driver implementation, behind the `agent-driver` package's contract: the `web` run target, which hands an agent's whole task to a Claude Code cloud session on claude.ai. It lives in the product rather than in the package because it needs the product — the daemon that queues the session request, the browser bridge that carries it, and the `@gemstack/agent-data` package's git runner that pushes the starting point. Every other driver (Claude Code and Codex locally, a GitHub Actions runner, the scripted fake) is the package's.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
