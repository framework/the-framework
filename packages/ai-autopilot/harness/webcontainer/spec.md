Browser-driven boot-and-serve proof for `WebContainerRunner`, which runs only inside a cross-origin-isolated browser and therefore cannot be verified by `node --test`.

## TLDR

- `server.mjs` — COOP/COEP static server exposing the page, the compiled `dist/`, and `@webcontainer/api` same-origin.
- `index.html` — drives the real compiled adapter through boot / fs round-trip / exec / start / preview / serve-proof / dispose / re-boot checks into `window.__RESULT__`; `?demo=1` renders the live preview instead of disposing.
- `drive.mjs` — playwright-core Chromium driver; exits 0/1 on the checks; `HEADED=1` keeps a real window open.
- `README.md` — what it proves and how to run it.

## Facts

- Opt-in and not part of `pnpm test` because it needs a Chromium and network (the WebContainer runtime downloads from StackBlitz on first boot); run `pnpm build` first.
- The Node-runnable guards (`webContainerAvailable()` false outside a browser, `boot()` throwing a clear error) live in `src/runner/webcontainer.test.ts` and DO run in the default suite.
