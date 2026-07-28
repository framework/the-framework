The multi-project read side (#392): summarizes registry records into `ProjectSummary` rows and defines the `ProjectsProvider` seam each host wires (`?project=<id>` → path resolution for every read endpoint).

## TLDR

- `summarizeProject(record)`: display name (path basename), `activated` (`.the-framework/` marker), `lastActivityAt` (newest of the latest `LOGS.md` entry and the latest run — a run counts even when it stopped before writing to LOGS.md), and `fileConfig` (the repo's committed `the-framework.yml` run defaults, #842, read fresh on every summarize so edits show without restart; omitted when empty/malformed).
- Three providers: `defaultProjectsProvider` (the global registry — the daemon), `singleProjectProvider(cwd)` (#427: per-run foreground dashboard / `--resume`, one fixed id, never pollutes the registry), `emptyProjectsProvider` (#426: the public relay — every file/registry-backed RPC resolves to nothing so an unauthenticated host serves only its in-memory event stream).
- All reads forgiving: a failed read is an inactive project with no activity, never a throw.

## Facts

- ISO timestamps sort chronologically as strings, which is how `lastActivityAt` picks the newest.
- Live streaming + per-project run start/stop were still single-project at this layer's introduction (#393).
