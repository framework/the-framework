Status: open
GitHub: [#411](https://github.com/gemstack-land/the-framework/issues/411)

# App instead of `localhost`?

## TLDR

Should the dashboard ship as a native app (Electron / Tauri / Wails) instead of `localhost:4200`? Verdict: stay localhost-first (the target audience is developers for now); a native shell stays an optional later wrapper, since the #405 rebuild produces a self-contained static Vike SPA bundle that any webview shell can wrap with near-zero rework. If ever going native: Tauri/Wails-style system webview over Electron — but note a native shell does *not* replace the Node daemon (it does the file I/O, spawns runs, tails logs), so memory = daemon + webview either way.

## Why it matters

Entry-point UX and positioning: `localhost` is familiar to developers (browser extensions work, trivially relay-shareable), while non-technical users need either a native app, a "local domain" (`the-framework.local` via `/etc/hosts`, shipped by a browser-less helper app), or — most likely — the hosted version. Recording the verdict avoids re-litigating; choosing localhost now costs nothing later.

## Source

Imported from GitHub issue [gemstack-land/the-framework#411](https://github.com/gemstack-land/the-framework/issues/411), created 2026-07-12, no labels, 4 comments.

### Original description

I wonder whether we should use Electron (or preferably something like Tauri if it's a viable solution).

Downside: bloat.

Upside: looks professional.

I think it's worth it... especially if we can use a solution that doesn't bloat the user's memory. Is Tauri (or some other tool) a good option?

### Notes from the GitHub thread

- Not an either/or: ship localhost now, wrap the same static bundle in Tauri later if wanted. Tauri over Electron (system webview, few-MB binary, low memory vs 100MB+ Chromium). Wails suggested as a Go-based alternative — same shape, same plan.
- Caveat: Tauri's backend is Rust and won't run the Node daemon; a native app = Rust shell + webview + the same daemon underneath.
- Maintainer: maybe eventually all three — localhost (local), app or "local domain" (local), web (hosted). Personal preference for localhost; Cursor's download page is the end-goal look for non-technical users, though most of them will likely use the hosted version. **Verdict: keep `localhost` for now (targeting developers).**
