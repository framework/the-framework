Status: open
Topics: [the-framework]
GitHub: [#469](https://github.com/gemstack-land/the-framework/issues/469)

# Browser Phase 2: bundle Chromium into the sandbox runner image

## TLDR

Phase 2 of #452: bake Chromium + chrome-devtools-mcp into the Docker runner image so the agent's browser works when a run is isolated in a container. Phase 1 (merged, #466) covers dev-machine runs with a host browser behind `--browser`. **Blocked** on the agent-in-container move (#109) — today the agent runs on the host with only the app inside the runner, so an in-image browser would have nothing pointing at it.

## Why it matters

Browser access inside sandboxed runs is what lets isolated agents visually verify the apps they build. It only pays off once the agent itself runs in the sandbox, and there's an explicit gating question first: has Phase 1's real-world use proven browser access valuable enough to carry into the sandbox story at all?

## Source

Imported from GitHub issue [gemstack-land/the-framework#469](https://github.com/gemstack-land/the-framework/issues/469), created 2026-07-14, label: `the-framework ♻️`.

### Original description

Phase 2 of #452. Phase 1 (merged, #466) gives the agent a browser on the **host** via chrome-devtools-mcp behind `--browser`. That covers dev-machine runs.

Phase 2 is the sandboxed version: bake Chromium + chrome-devtools-mcp into the Docker runner image so the browser works when the run is isolated in a container.

**Blocked** on the agent-in-container move (#109). Today the agent runs on the host and only the app is served inside the runner, so an in-image browser has nothing pointing at it. This only pays off once the agent itself runs inside the sandbox.

Scope when unblocked:
- Alpine needs `chromium` + fonts + `--no-sandbox`.
- MCP config points chrome-devtools-mcp at the in-container browser.
- Gated on a real Docker env (#109).

Also worth deciding first, from Phase 1 real-world use: is browser access valuable enough to carry into the sandbox story at all?
