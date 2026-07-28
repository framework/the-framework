Launches the run's own shared Chrome with an open CDP debug port and wires the `--browser` chrome-devtools-mcp server to it (#452/#793, first slice of #609).

## TLDR

- `resolveChromePath()` — `CHROME_PATH` / `PUPPETEER_EXECUTABLE_PATH` overrides first, then per-platform well-known paths, then PATH lookup; `undefined` when the machine has none.
- `launchSharedBrowser()` — free port (asked of the OS) + throwaway profile + `--remote-debugging-port`; polls `/json/version` until Chrome answers; returns `{browserUrl, close}` or `undefined`.
- `browserMcpServers(browserUrl?)` / `withBrowser()` — fold the chrome-devtools-mcp spec (with `--browserUrl` when we launched Chrome) into Claude driver options.

## Problems

- chrome-devtools-mcp launching its own Chrome left no port open for a second CDP client, so the #609 human screencast could not attach; launching Chrome ourselves lets both clients attach at once.
- Chrome opens its debug port a beat after the process starts — `waitForDebugEndpoint` polls before the URL is handed out (the obvious race).
- A Chrome that dies on its own, or a spawn that errors (bad path, no exec bit), must not leave the run pointing at a dead port or throw unhandled: both `exit` and `error` handlers trigger cleanup; a missing browser only costs the preview, never the run.

## Decisions

- No Chrome found ⇒ `undefined`, and the caller leaves `--browser` exactly as it was (the MCP server launches its own): browser tools survive, only the preview is lost.
- Headless (`--headless=new`) by default with a throwaway `--user-data-dir`, so a run never inherits or dirties the user's real Chrome session; close() kills Chrome and removes the profile, idempotent.
- `exists` is an injectable parameter so path-resolution tests mean the same thing on CI (Chrome installed at well-known paths) and a laptop.
- `npx -y chrome-devtools-mcp@latest` resolves the MCP server on demand — nothing to pre-install; merged into the build driver only, not the short preset-router turn.
