The dashboard's development server and production build. `pnpm dev:dashboard` serves the dashboard at `http://localhost:4300` with live reload and no daemon behind it; `pnpm dev:daemon` also runs the real daemon inside the dev server's own process and forwards every call and the live stream to it, so a developer can start agents [1] from the live-reloading dashboard; the production build writes the bundle exactly where the daemon serves it from.

## Context

**User story**: a developer edits the dashboard and sees the change on save. To watch a real project, the developer runs `pnpm dev:daemon`, adds a project and starts an agent [1] from the dashboard, the only place an agent can be started, and Ctrl-C in that terminal takes the daemon down together with the dev server.

**Problem**: the dashboard is a projection of what the daemon writes and answers. On its own, the dev server is a pure interface harness: nothing answers a call, so starting an agent fails and preferences [2] do not persist. Only the daemon can start an agent, and the daemon never runs detached, so there is no daemon to borrow; the dev server hosts one itself.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[3] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.

## Business logic — TL;DR

- **The plain dev server** - `pnpm dev:dashboard` serves the dashboard on port 4300 as a pure interface harness: every call fails, so the pages show their empty state and the daemon-unreachable bar, starting an agent [1] fails, and preferences [2] do not persist.
- **The dev daemon, opt-in** - with `FRAMEWORK_DEV_DAEMON=1` (what `pnpm dev:daemon` sets) the built daemon starts inside the dev server's process, in `FRAMEWORK_DEV_DAEMON_CWD` or the current directory, on a port of the system's choosing, and ends with the dev server.
- **Calls are forwarded to the dev daemon** - every request under `/_rpc`, the live stream included, and every widget [3] file under `/_widgets/`, is forwarded to the dev daemon as the browser sent it, waits while the daemon is still coming up, and is refused rather than hung when the daemon failed to start.
- **The production bundle lands where the daemon serves it** - the build writes to the package's `dist/dashboard-bundle`, emptied first, which the daemon serves as static files with a single-page fallback.
- **What a widget shares with the page** - the page carries an import map pointing `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client` and `framework/widget` at the page's own running copies, built as entries of their own at fixed names under `host/`, so a widget [3] loaded later renders in the same React and uses the same components.

## Business logic

### The plain dev server

#### Context

See `## Context`.

#### Business logic

`pnpm dev:dashboard` serves the dashboard's own directory (pinned, since the package's scripts run one level up) at port 4300 with live reload. Nothing answers the dashboard's calls: every call fails, so the pages show their empty state and the bar saying the daemon is not answering, starting an agent [1] fails, and preferences [2] are not persisted. This is deliberate, so the plain dev server stays a pure interface harness with nothing behind it.

### The dev daemon, opt-in

#### Context

**Problem**: the daemon always runs in the foreground and never detaches, so there is no daemon to reuse, and a second daemon on the usual port 4200 would collide with one the developer runs in another terminal.

#### Business logic

Only when `FRAMEWORK_DEV_DAEMON` is set, which the `pnpm dev:daemon` script does, and only while serving (never during a build), the dev server starts the daemon inside its own process from the package's built output (`dist/daemon.js`), so the package must have been built first. The daemon's working directory is `FRAMEWORK_DEV_DAEMON_CWD` when set, else the directory the dev server was started from. It binds a port the system picks, never the daemon's usual 4200, and the browser keeps talking to the dev server's address alone. Once it is up, the dev server logs "[framework] dev daemon started at <url> — starting runs is enabled". Because it runs in-process, Ctrl-C on the dev server ends the daemon and every agent [1] it runs, leaving nothing behind. If the daemon fails to start or exits before binding, the dev server logs "[framework] dev daemon did not start (<reason>); reads still work, but starting a run stays disabled" and carries on without one; calls then fall through as described in the next section.

### Calls are forwarded to the dev daemon

#### Context

**Business logic story**: the dashboard reaches the daemon over same-origin calls and one live stream; in development that origin is the dev server, so the dev server must carry them to the daemon.

#### Business logic

Every request whose path starts with `/_rpc`, the calls and the live event stream alike, and every request for a widget [3] file under `/_widgets/`, is forwarded to the dev daemon with the method, path and headers the browser sent, and the daemon's answer is streamed back unchanged, so the live stream rides through. The `Host` header is left as the browser sent it, which is what lets the daemon's same-origin and expected-host guards (`src/dashboard/rpc-serve.ts`) accept the forwarded request. The forwarding is in place before the daemon is up: a request that arrives early waits until the daemon has bound and is then forwarded; if the daemon failed instead, the request falls through to the dev server's own handling and is answered "not found", never left hanging. A transport error toward the daemon answers 502 with "framework dev daemon proxy error". Any other path is the dev server's own, serving the dashboard's files.

### The production bundle lands where the daemon serves it

#### Context

**Business logic story**: the daemon serves the built dashboard as static files, so the build and the daemon must agree on one directory.

#### Business logic

The build (part of the package's `build` script) writes the bundle to the package's `dist/dashboard-bundle`, emptied before each build, with `index.html` as the single entry. The daemon serves that directory as static files and answers any path that is not a file with `index.html`, so the dashboard picks its page from the URL (`src/dashboard/static.ts`).

### What a widget shares with the page

#### Context

**Problem**: a widget [3] is built on its own, in its package, and loaded into a page that is already running. Bundling its own React would give it a second React the page's tree cannot hold, and its own copy of the dashboard's components would drift from the page's.

#### Business logic

The page's `index.html` gets an import map ahead of every script. In the production build it maps `react`, `react/jsx-runtime`, `react-dom` and `react-dom/client` to `/host/react.js`, `/host/react-jsx-runtime.js`, `/host/react-dom.js` and `/host/react-dom-client.js`, and `framework/widget` to `/host/widget.js`. Each of those is built as an entry of its own at that fixed name, sharing every module with the page's main entry, so importing it gives the very copy the page runs; its exports are kept whole, since they are imported from outside the bundle. React ships in a form whose names a plain re-export would lose, so each React entry is generated to re-export every name the installed React package has, read at build time; a React upgrade that adds a name can never leave it out. `framework/widget` is the file `widget/index.ts`. On the dev server the same names map to the dev server's own copies of the same modules.

