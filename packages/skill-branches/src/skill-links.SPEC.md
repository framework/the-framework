Puts the skill where the agent's harness looks for one. Every checkout the package creates gets a link per harness — under `.claude/skills/` for Claude Code, under `.agents/skills/` for Codex — named `branches` and pointing at the package, whose `SKILL.md` is the skill. A caller may name further skills to be linked in beside it, each under its own name — temporarily, see below. The links are hidden from the project's git through the repository's own exclude file.

## Business logic — TL;DR

- **One mechanism for every harness** - each harness reads skills from a directory of its own at the checkout root; the package links the same skill into each, so every agent, whichever harness runs it, is told the same thing. A new harness is one more directory in the list.
- **The checkout is the place** - a checkout under `.branches/` is its own repository root to a harness, so a skill the project keeps at its own root never reaches the agent; the link has to be in the checkout.
- **Hidden, best-effort, idempotent** - the links are the package's state, not the agent's work: hidden from git so they never ride a commit, left alone where something already sits at their path, and a link that cannot be made means an agent without the skill, not a failed start.
- **Other skills the caller names, temporarily** - a caller can hand over further skills, each a name and the directory holding that skill's `SKILL.md`, and each is linked into every harness's directory beside this package's own, under the same rules. This exists only because nothing else puts a skill into an agent's checkout yet: once skills are committed into the repository, a tracked skill directory is in every checkout by itself, and the package goes back to linking only its own.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
