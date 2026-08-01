Resolves the checkout a run id addresses (#738/#797): the run's own worktree while it exists, else the project root.

## TLDR

- Order: reject unsafe/absent ids → live metas (a running run records its cwd) → the worktree directory itself → project root fallback.
- The one shared resolution for every run-addressed surface (daemon serve targets/previews, each dashboard RPC), so the fallback rules cannot drift apart.

## Problems

- The worktree directory exists before the run has written its `run.json` (#766): the daemon creates the dir, spawns the process, and only then does the run write meta — so a lookup by run state alone misses a run that certainly exists; hence the directory probe.
- The probe matters beyond a slow first read: a Telefunc Channel resolves its path once at subscribe time, so a wrong fallback would tail the wrong file for the life of the subscription — how a newly started run once showed a previous run's output.
- Unknown/finished ids fall back to the project root rather than failing: the worktree may already be gone and the project's own state is still the sane thing to act on.

## resolveRunEventsPath (#1472)

- The events-journal variant of the same resolution, used only by the events tails (`onEvents`, the daemon's `/_relay/events`): live meta cwd → worktree → the run's **archived** `<id>.jsonl` → root journal.
- Where `resolveRunCheckout` would fall back to the root, an existing archive wins: the archive proves the run ended and is the run's own record, while the root journal belongs to whatever root run wrote it last — tailing it streamed a foreign run's feed (masked client-side until #1471, wasted IO regardless).
- The root journal stays the final fallback for the no-archive residue, so a just-starting root run (no meta yet, no worktree to probe — the #766 window) streams exactly as before.
- Ordering matters for a resumed run: its recreated worktree (live journal) must beat its stale archive from the earlier leg.
