Gives a fresh checkout [1] a working dependency tree without copying or installing anything: every `node_modules` directory of the user's checkout, from the project root down to two directory levels below it, is mirrored into the checkout as a real directory holding one link per entry, with the package manager's private state left out.

## Context

**User story**: an agent [2] starts in a checkout that git created from the repository alone, and `node_modules` is not in the repository. Without this, every command the agent runs fails until it installs; with it, the agent starts at once, no extra disk is spent, and one installed tree serves every agent working the project.

**Problem**: a checkout whose whole `node_modules` is a link to the user's makes the user's tree the checkout's own in the package manager's eyes. An agent that changes a dependency and runs an install then has the package manager rewrite, or purge outright, the user's real `node_modules`, and every later agent fails at start. A real directory of the checkout's own, holding links, makes an install in the checkout write into the checkout.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout" or "the user's checkout".
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Which dependency trees are found** - every `node_modules` of the project root and of directories up to two levels below it, workspace packages included, never looking inside dependency, git, build or dot directories.
- **How a tree is mirrored** - a real directory at the same relative path in the checkout, with one absolute link per entry of the user's tree.
- **What is never linked** - the package manager's private state, every dot-entry except `.bin`.
- **Best-effort, and repeatable** - a tree already present is left alone, a link or directory that cannot be made is skipped, and nothing here ever fails the agent's start.

## Business logic

### Which dependency trees are found

#### Context

See `## Context`.

#### Business logic

Starting at the project root, every directory named `node_modules` is collected: the root's own, and those of directories up to two levels deep, which covers a workspace's `packages/<name>/node_modules` and `examples/<name>/node_modules`. A `node_modules` whose parent sits three or more levels deep is not found. The walk never enters a `node_modules` directory, `.git`, `dist`, `build`, `coverage`, or any directory whose name starts with a dot (`.branches/` among them, so other checkouts [1] are never scanned). The trees are handled in a stable, sorted order.

### How a tree is mirrored

#### Context

See `## Context`.

#### Business logic

For each tree found, the checkout [1] gets a real directory at the same relative path, and inside it one symbolic link per entry of the user's tree, each pointing at the entry's absolute path in the user's checkout. A package's files are therefore read from the user's tree, while anything an install in the checkout writes replaces the checkout's own link and leaves the user's tree untouched. Two limits follow from linking entries one by one: a scope directory such as `@acme` is one entry, so a package installed under it from the checkout lands in the user's tree; and `.bin` is one entry, so an executable an install adds lands there too. On Windows the links are junctions, the one kind of directory link made without elevated rights.

### What is never linked

#### Context

**Problem**: a package manager keeps its own state inside `node_modules` (`.pnpm`, `.modules.yaml`, and the like). That state is what tells it "this tree is mine, installed here", and the checkout's tree is not installed there.

#### Business logic

Every entry whose name starts with a dot is skipped, except `.bin`. `.bin` is linked because the agent [2] runs the project's tools through it. The packages still resolve without the private state: a package entry in a pnpm tree is a relative link into `.pnpm`, and a link to that link resolves where its target lives, in the user's checkout [1].

### Best-effort, and repeatable

#### Context

**Business logic story**: everything a checkout gets after its files is best-effort (`checkout.ts`): a checkout missing its dependencies is a worse agent, not a failed one.

#### Business logic

A tree already present in the checkout [1] at a mirrored path is left alone, links and all: the agent [2] may have installed its own. A directory that cannot be made skips that tree; a single link that cannot be made is skipped and the tree still counts as mirrored. Nothing here raises an error to the caller; the caller learns which trees were mirrored. Running the mirroring again over the same checkout links nothing new.
