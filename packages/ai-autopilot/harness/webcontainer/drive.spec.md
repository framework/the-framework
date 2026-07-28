Playwright driver for the WebContainer boot-and-serve proof: launches Chromium, loads the harness page from the COOP/COEP server, waits up to 90s for `window.__RESULT__.done`, prints `<passed>/<total> checks`, and exits 0/1 (2 when no browser is usable).

## TLDR

- Prefers system Google Chrome (`chromium.launch({ channel: 'chrome' })`, no browser download), falls back to a Playwright Chromium (`npx playwright install chromium`).
- `HEADED=1` opens a real window, loads the page with `?demo=1` (live preview rendered), and stays open until Ctrl-C.
- Forwards page console/pageerror output to the terminal for debugging.

## Facts

- Prereqs: `pnpm build` first (the page drives the compiled `dist/` adapter) and network access — WebContainer downloads its runtime from StackBlitz on first boot.
