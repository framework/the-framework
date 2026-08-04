Run state on disk: the append-only event log that *is* a run's state, plus git-worktree lifecycle so concurrent runs never share a working tree.

## TLDR

- `run-store.ts` — the event store and its meta projection (see spec).
- `worktree.ts` — worktree/branch lifecycle (see spec).
- `worktree-deps.ts` — symlink the parent checkout's `node_modules` trees into a fresh worktree, and write the git exclude rule for the links.
- `run-checkout.ts` — the one place a run id becomes a path.
- `suspend.ts` — the runs a shutting-down daemon stopped, with a 24h resumability cutoff.

## Decisions

- Torn-line policy, stated once: a blank or malformed log line **stops** the read, keeping everything up to the cut. The reader is exported so outside consumers cannot keep a drifted copy.
- `worktree-deps.ts`: of copy (gigabytes per run) / install (latency per run) / **symlink** (instant, one store shared by N runs), symlink wins; the one case it's wrong — a run changing the lockfile — needs its own install anyway, and the agent runs it. Directory-level symlinks keep pnpm's internal links resolving against their real location; Windows gets junctions (no elevation needed).
- `run-checkout.ts`: resolution is live meta's cwd → a worktree **directory probe** → fallback. The probe is not just a fast path — the daemon creates the directory and spawns the run before the run writes its meta, and a live-events channel resolves its path **once at subscribe time**, so falling back to the project root would tail the wrong file for the subscription's life.
- For an *ended* run, the archived per-run log wins over the project-root journal — the archive's existence proves the run ended, and the root journal belongs to whatever wrote it last.

## Facts

- The `node_modules` exclude rule must be slash-free (a trailing slash matches directories only, so the *symlinks* would show as untracked and ride an agent's `git add -A` onto the PR) and must go in the **common** git dir's `info/exclude` — a per-worktree copy looks right and silently does nothing.
- Some path constants live in `run-store.ts` even where they conceptually belong elsewhere, purely to avoid import cycles.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
