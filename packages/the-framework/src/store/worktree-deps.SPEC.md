Gives a fresh worktree a working dependency tree, so an agent can run the project's commands the moment it starts, and keeps that tree invisible to git so the agent never commits it.

## Business logic — TL;DR

- **Dependencies are shared, not copied** - the parent checkout's `node_modules` directories are linked into the worktree at the same relative paths, instantly and at no extra disk cost.
- **Workspace packages get their own link** - every `node_modules` down to two levels below the repo root is linked, so a monorepo's packages work too.
- **The links are hidden from git** - the repo is told to ignore them, or the agent would commit dangling links onto its branch and into its pull request.
- **Never fatal** - a link that cannot be made is skipped; a worktree with missing dependencies is a worse agent, not a failed one.

## Business logic

### Dependencies are shared, not copied

#### User story

The user starts an agent and it works immediately: it can run the tests, the build, the linter. It does not sit for a minute installing, and starting ten agents does not fill the disk.

#### Business logic

Dependency directories are ignored by git, so a new worktree is handed an empty one and every command in it fails. Instead of copying or installing, the parent checkout's dependency directories are linked into the worktree at the same relative paths. Anything already present at a link's location is left alone, since the agent may have installed for itself already, and any missing parent directory is created first.

The scan looks for a dependency directory at the repo root and at every directory down to two levels below it, which covers a workspace's per-package dependencies without walking the whole tree. Dependency directories, the git directory, the framework's own directory, build outputs and dot-directories are never descended into. The result is ordered, so linking happens in a stable order.

#### Rationale

Three options existed: copy the tree (correct, but gigabytes per agent), install into each worktree (correct, but real waiting on every start), or link the parent checkout's trees in (instant, no extra disk, one store shared by all agents). Linking wins. The one case it is wrong for is an agent that changes the dependency manifest — and that agent needs its own install anyway, which it runs itself.

Whole directories are linked, rather than their contents, because that is what makes a workspace resolve: the links inside a package's dependency directory still point at their real location in the parent checkout.

### The links are hidden from git

#### User story

The agent's pull request contains its work and nothing else — no dependency directories, no broken links pointing at a path that only exists on the machine the agent ran on.

#### Business logic

A repo's ignore rules normally name the dependency directory with a trailing slash, which matches a real directory only. The linked trees are links, not directories, so those rules do not cover them and they show up as untracked in every agent's worktree. That matters because the agent stages everything it changed, so it would commit those links onto its branch and into its pull request.

A rule without the trailing slash is therefore added to the repo's own local exclusions, covering the link form in every worktree. The main checkout is unaffected, because its dependency directory is a real directory already ignored under the same name.

This is best-effort as well: on a project that is not a git repo, or where the exclusion cannot be written, the links simply stay visible to git status.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
