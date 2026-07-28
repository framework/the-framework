Resolves the checkout a run id addresses (#738/#797): the run's own worktree while it exists, else the project root.

## TLDR

- Order: reject unsafe/absent ids → live metas (a running run records its cwd) → the worktree directory itself → project root fallback.
- The one shared resolution for every run-addressed surface (daemon serve targets/previews, each dashboard RPC), so the fallback rules cannot drift apart.

## Problems

- The worktree directory exists before the run has written its `run.json` (#766): the daemon creates the dir, spawns the process, and only then does the run write meta — so a lookup by run state alone misses a run that certainly exists; hence the directory probe.
- The probe matters beyond a slow first read: a Telefunc Channel resolves its path once at subscribe time, so a wrong fallback would tail the wrong file for the life of the subscription — how a newly started run once showed a previous run's output.
- Unknown/finished ids fall back to the project root rather than failing: the worktree may already be gone and the project's own state is still the sane thing to act on.
