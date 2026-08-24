Effort: 1
Uncertainty: 2

# [Plan] App instead of `localhost`?

Close-out plan: the maintainer's verdict (stay localhost-first) is already on the ticket, so the remaining work is to record the decision durably and close the ticket — no product code.

## TLDR

The decision is made and recorded in the ticket itself (maintainer, GitHub #411 thread: "keep `localhost` for now, targeting developers"). The codebase already matches the verdict and already keeps the native-shell option cheap, so nothing needs building or refactoring. What's left: write the decision into `MEMORY.md`'s Decisions section (the repo's durable decision log — there is no `knowledge-base/DECISIONS.md` in this project), park the native-shell idea in `VISION.md` so it isn't lost, close GitHub issue #411 with the verdict, and remove the ticket files.

## Why nothing needs building — verified against the codebase

- **The #405 premise holds on `main`**: the daemon serves the built dashboard bundle itself (`packages/framework/src/daemon.ts` — "The daemon serves the built dashboard bundle (#405/#426)"), a single-page Vite app under `packages/framework/dashboard/` that talks to the daemon over `POST /_rpc/<name>` and SSE. Any future native shell is a webview pointed at the daemon's existing localhost URL — zero rework in the SPA, exactly as the ticket claims.
- **A native shell would not replace the daemon** (ticket caveat, confirmed by the architecture): the Node daemon does the file I/O, spawns sessions, and serves the bundle; a Tauri/Wails shell (Rust/Go backend) would sit *beside* it, so memory = daemon + webview either way. The "bloat" upside of Tauri over Electron is real but the daemon cost is a floor no shell removes.
- **The localhost entry point is already invested in**: `packages/framework/src/loopback-host.ts` hardens it (loopback-only binds skip the token gate, DNS-rebinding guard rejects rebound `Host` headers like `127.evil.com`, #1051). This is sunk cost that only pays off in the browser-page model.
- **Existing decisions lean the same way**: `MEMORY.md` already records "The CLI always runs in the foreground… no background/detached daemon mode" and "the dashboard … is the product's only user interface". A native app implies an app lifecycle (dock icon, own process supervision, auto-start) that would reopen the foreground-CLI decision — one more reason the verdict is coherent, and worth stating in the recorded decision.
- **The browser-extension benefit is not hypothetical**: `packages/chrome-extension/` exists and works because the dashboard is a normal browser page. A native webview shell would cut it off (webviews don't run extensions) — worth a line in the recorded decision so a future revisit weighs it.

## Problems

1. **Where to park the "maybe later: native shell" idea** — the only real choice in this close-out, and a small one. The thread's end state is "maybe eventually all three: localhost, app/local-domain, hosted", so the idea shouldn't vanish with the ticket. `VISION.md` has both a "Candidates" and a "Postponed" section; "Postponed" fits the thread's tone best (explicitly deferred, not competing for attention). This is the whole of the Uncertainty rating — cheap either way, and an implementing agent can pick "Postponed" without asking.

There are no technical problems: the verdict is status quo, so no code changes, and `FEATURES-SPEC.md` needs no update (no user-facing feature is added or removed).

## Implementation

1. **Record the decision in `MEMORY.md` → Decisions** (read https://raw.githubusercontent.com/brillout/ai-memory/refs/heads/main/memory.md first, per the file's own footer). Suggested entry, matching the existing entries' shape:
   > **The dashboard is a browser page on `localhost`, not a native app.** The target audience is developers: `localhost` keeps browser extensions working (the Chrome extension depends on it) and stays trivially relay-shareable. A native shell (Tauri/Wails-style system webview, not Electron) remains possible later at near-zero cost — the daemon already serves the self-contained SPA bundle, and a shell is just a webview pointed at it — but it would not replace the Node daemon, and non-technical users are expected to use the hosted version instead.
2. **Park the idea in `VISION.md` → Postponed**: one line, e.g. `- Native-app shell for the dashboard (Tauri/Wails webview over the existing localhost bundle) — see MEMORY.md decision`.
3. **Close GitHub issue [#411](https://github.com/gemstack-land/the-framework/issues/411)**: short comment stating the verdict and that it's recorded in `MEMORY.md`, then close as completed.
4. **Close the ticket**: remove `tickets/2026-07-12_app-instead-of-localhost.md`, this `.plan.md`, and the `.lock.md` from `tf-data`.

Steps 1–2 are a normal code-branch PR; steps 3–4 ride the close-out. Effort 1 (two doc edits, an issue comment, file removals); Uncertainty 2 (verdict already made by the maintainer — only the parking spot for the later-maybe is a judgment call).
