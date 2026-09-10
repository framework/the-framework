Puts the `branches` skill, this package's `SKILL.md`, where each coding agent [1] looks for skills at the root of an agent's checkout [2]: one symbolic link per coding agent's skill directory, named `branches` and pointing at this package's directory, hidden from git through the repository's exclude file. A caller may name further skills to link in beside it the same way.

## Context

**User story**: an agent [3] starting in its checkout reads the `branches` skill and learns where its work goes and what must be true before it finishes, whichever coding agent runs it and whatever the project's repository commits.

**Problem**: a coding agent discovers skills under a directory of its own at the root of the working tree it runs in: `.claude/skills/<name>/SKILL.md` for Claude Code, `.agents/skills/<name>/SKILL.md` for Codex. An agent's checkout is its own working tree to the coding agent, so a skill has to be present in every checkout; and a link at the checkout root would ride any sweeping `git add -A` onto the agent's branch unless git is told to ignore it.

## Glossary

[1] coding agent: the CLI doing the actual work: Claude Code or Codex.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **The skill in every checkout** - `.claude/skills/branches` and `.agents/skills/branches` in the checkout link to this package's directory, whose `SKILL.md` is the skill.
- **Hidden from git** - each link's path is added to the repository's exclude file, so the checkout stays clean and the link never rides onto a branch.
- **An entry already there is left alone** - a committed skill or anything else at a link's path is kept, and a link that cannot be made costs the agent the skill, not its start.
- **Further skills named by the caller** - each under its own name, pointing at the directory holding its `SKILL.md`, in the same two places and under the same rules.

## Business logic

### The skill in every checkout

#### Context

See `## Context`.

#### Business logic

Every checkout [2] the package makes gets, for each coding agent [1] skill directory (`.claude/skills` and `.agents/skills`, both relative to the checkout root), a symbolic link named `branches` pointing at this package's own directory, the one holding `SKILL.md`. The skill's name `branches` is the `name` in `SKILL.md`'s front matter and the directory name the coding agent lists it under. The package's directory is the same path whether the package is a workspace checkout of this repository or an installed dependency. One mechanism serves every coding agent, and every agent [3] reads the same text.

### Hidden from git

#### Context

See `## Context`.

#### Business logic

Before each link is made, the rule `/.claude/skills/branches` (respectively `/.agents/skills/branches`, and the same for every further skill's name) is added once to the repository's own exclude file, the ignore list that is git's and not the project's, so no tracked file changes and one rule covers every checkout [2] of the repository. The links are the package's state, not the agent's [3] work: a checkout with them reads clean, with nothing to commit. A failure to write the exclude file is ignored.

### An entry already there is left alone

#### Context

**Problem**: a project may commit a skill of the same name, and an agent [3] may have put something at that path itself.

#### Business logic

When anything already exists at a link's path (a directory, a file, or a link of any kind), it is kept and no link is made. When the link cannot be made because the filesystem refuses it, the agent [3] still starts, without the skill. Linking again over the same checkout [2] changes nothing, so a continued agent's checkout can be set up as often as needed.

### Further skills named by the caller

#### Context

**Problem**: a project whose repository does not commit its skills has no other way to give an agent [3] the `tickets`, `queue` and `logs` skills; the daemon names them when it makes a checkout. The command line offers no way to name them.

#### Business logic

Each further skill is given as a name and the directory holding its `SKILL.md`. It is linked exactly as the package's own: one link per coding agent [1] skill directory, named as the skill, pointing at that directory, excluded from git, an existing entry left alone. The package's own skill is always linked first.
