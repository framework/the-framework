Branch management for coding agents, as an npm package: one git checkout per agent under a project's `.branches/`, named as its branch; the parent checkout's dependencies shared into it; a navigable link per branch name; one retention rule under which a checkout is reclaimed — only once everything it holds is on the remote; and the instructions an agent follows to live inside that rule (`SKILL.md`).

The package knows git and the filesystem, nothing else. Running git, the exclude that hides `.branches/` from the project's git, and the `.branches` name itself are the `@gemstack/agent-data` package's, which this package depends on. The same functions serve every caller: a daemon that starts agents, a dashboard that lists and reclaims checkouts, and an agent's own shell, through the `branches` command a daemon puts on the PATH of every agent it starts on its machine. What a caller knows beyond git — whether an agent is still running, whether the caller allows a push, which pushed commit already holds its work — is passed in; the package never reads an agent's record.

## Business logic — TL;DR

- **The conventions** (`branch-names`) - branch names, the checkout directory layout under `.branches/`, and the agent-id charset every path is built from.
- **A checkout's lifecycle** (`worktree`) - create, attach, list, name, remove, prune; the reads every retention decision is built on; the project a directory belongs to.
- **A checkout as an agent gets it** (`checkout`) - the worktree, `.branches/` hidden from git, the dependencies linked in, the skill linked in, the links refreshed: one sequence for a daemon and the command line.
- **The skill where the harness looks** (`skill-links`) - a link per harness in every checkout the package creates — `.claude/skills/branches`, `.agents/skills/branches` — to the package's own `SKILL.md`, hidden from git; one mechanism for every harness. A caller may name further skills to be linked in beside it, which it may do temporarily, until skills are committed into the repository.
- **Dependencies shared, not copied** (`worktree-deps`) - a fresh checkout gets the parent's dependency trees as directories of links.
- **Reachable by branch name** (`branch-links`) - a symlink per current branch name beside the checkouts.
- **Reclaiming a checkout** (`reclaim`) - the one rule: keep a dirty tree, push the branch when allowed, remove only once the remote has it, and delete an agent branch that holds nothing.
- **The command line** (`cli`, `bin/`) - the same operations as commands for a shell: JSON on stdout, a reason on stderr, an exit code that tells a refusal from a usage error; the executable's directory is exported (`bin-dir`) for a caller that spawns agents.
- **The skill** (`SKILL.md`) - what the agent is told: its checkout is its whole workspace, it names its session with `branches name` before its first change and uses the name the command prints, it commits as it goes, leaves a clean tree, and never publishes itself. An agent finds it as a skill of its harness in every checkout the package creates; nothing has to be put in a prompt.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
