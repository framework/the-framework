Named accessors over the Telefunc request context, through which each host (daemon, per-run foreground, relay) wires the capabilities its telefunctions may use.

## TLDR

- `fromContext` reads one field off `getContext<DashboardContext>()` with a try/catch fallback for calls made outside a request (e.g. direct test calls).
- `contextProjects()` (#427): the `ProjectsProvider` to resolve project ids against — daemon leaves it unset so the global registry default applies; the per-run foreground sets a single-project provider scoped to its `cwd`.
- `resolveProjectPath(projectId)`: the project's workspace path or undefined.
- `resolveRunPath(projectId, runId?)` (#738/#749): the checkout a run-addressed call must act on — the run's own worktree when `runId` names one, else the project root; delegates to the store's `resolveRunCheckout` (which owns the #766 first-seconds subtlety), shared with the daemon.
- Capability accessors, each undefined where the host does not wire it: `contextPreview` (#475), `contextEventsSource` (#426, relay-only in-memory events), `contextRemote` (#1067, daemon-only relayed-run lookup), `contextPreferences` (#410), `contextDiscord` (#1095), `contextQuota` (#533), `contextAutoPm` (#1161), `contextAutoPmSweep` (#1210).

## Decisions

- Host capability = presence of a context field: an unset field makes the corresponding RPCs degrade (empty reads, refused writes) instead of the host branching on "am I the relay".
- A shared/public host deliberately gets no preferences store, Discord store, quota source, or auto-PM: it must not hold one user's credentials, read someone else's account, or report on a sweep nobody runs.

## Facts

- Since #736 a run reads and writes inside its own worktree (its event log, control log, working tree), so anything addressed at a *run* must resolve through `resolveRunPath` or it reads an empty log and steers a run that is not listening.
- The daemon's `EventsSource` answers only for relayed runs; everywhere else `onEvents` tails the on-disk file.
