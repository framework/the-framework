On-demand app preview (#475): boots a project's dev script (or a built-in static server) in the daemon process and hands back a URL + stop handle — the "show it" twin of the run's "verify it" serve gate.

## TLDR

- `startPreview({cwd, target?, waitMs?})`: runs the picked target's script, else the root's first `PREVIEW_SCRIPTS` entry (`dev`, `start`, `preview`, `serve`), else a static server when an `index.html` exists; throws when there is nothing to serve or no URL is announced.
- `PreviewHandle`: `url`, `command` (`npm run <script>` or `static`), idempotent `stop()`, and `exited` (resolves when no longer serving — stop or self-exit) which the daemon watches to evict dead previews.
- `detectServeTargets(cwd)` (#651): enumerates servable apps best-first — root package, then each workspace package with a serve script (from `pnpm-workspace.yaml` `packages:` or the package.json `workspaces` field), for the dashboard's picker.
- `parsePreviewUrl(output)`: first browsable localhost URL a dev server prints, ANSI-stripped, `0.0.0.0` normalized to `localhost`, trailing punctuation trimmed.

## Problems

- Killing the whole tree: the dev script is spawned `detached` (its own process group) so `stop()` can SIGTERM `-pid` (npm and everything under it), escalating to SIGKILL after 3s.
- URL discovery: watches stdout+stderr until `parsePreviewUrl` matches, with a `waitMs` (default 20s) timeout and failure on early exit/spawn error; on any failure the child is stopped before rethrowing.
- Static-server safety: `decodeURIComponent` of a malformed escape (`/%zz`) must not throw — this runs void-dispatched, so an exception would be an unhandled rejection taking the process down (#938); path traversal is refused after normalization (403), `join(root, '.')` drops a trailing separator so a `dir/`-shaped cwd cannot fail the prefix check.
- Static-server shutdown: `closeAllConnections()` before `close()` so lingering keep-alive sockets from an open tab cannot hang the stop.

## Decisions

- Workspace-glob expansion is hand-rolled (literal dirs, single `*` segment, trailing `**`) by walking the tree rather than pulling in a glob dependency; negation patterns (`!`) are skipped, dirs without `package.json` don't count.
- Bounded scans: the tree walk stops at 2000 visited dirs and targets cap at `MAX_SERVE_TARGETS` (50), so a pathological monorepo can't hang or flood the picker; `node_modules` and dotdirs are never descended into.
- `pnpm-workspace.yaml` wins over the package.json `workspaces` field; unreadable/absent config just yields the root (or nothing).
- Deliberately a quick-win (#475): a URL + a Stop, not a full in-dashboard preview view.

## Facts

- `ServeTarget.id` is the dir relative to the repo root (`.` for root); label is package name, else dir basename (`root` for the root).
- The static server binds `127.0.0.1:0` (ephemeral port), defaults `/` and directories to `index.html`, 404s non-files.

## Flows

- dev preview: `startPreview` → `spawn('npm', ['run', script], {detached})` → collect output until `parsePreviewUrl` hits (or timeout/exit → stop child, throw) → `{url, command, exited, stop}`
- static preview: `createServer` → listen on ephemeral port → serve files under root with traversal checks → `{url: localhost:<port>, command: 'static'}`
- target detection: root package → workspace globs (pnpm yaml ?? workspaces field) → `expandWorkspaceGlob` walk → packages with a serve script, in path order
