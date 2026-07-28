Types and design doc for scale mode (#114): the `CodeOverview` data model, the material-change verdict, the injected `Regenerate` step, and the `OverviewFs` persistence slice.

## TLDR

- `CodeOverview` = `{ summary, sections: {title, body}[] }` — the parsed `CODE-OVERVIEW.md`.
- `MaterialChange` = `{ material, reasons }`; `OverviewRefresh` = `{ refreshed, reasons, overview? }`.
- `Regenerate(ctx)` — injected producer; `RegenerateContext` carries `reason`, optional `previous`, `event`, `signal`.
- `OverviewEvent` — maintainer progress: `skip` | `refresh` | `generated`.

## Facts

- Design premise (module doc): the hard part is not generating the overview once but keeping it current — a stale overview is worse than none — hence the material-change trigger wired into the loop (#113) rather than per-edit or on-demand-only refresh.
- `OverviewFs` is deliberately the same `read/write/exists` subset as the decisions store, so a booted runner session's `fs` satisfies both and the overview persists inside a sandbox the same way it does on the host.
