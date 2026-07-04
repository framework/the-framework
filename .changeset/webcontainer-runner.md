---
'@gemstack/ai-autopilot': minor
---

Add WebContainerRunner, the in-browser sandboxed runner

`WebContainerRunner` is the third real `Runner` adapter (after `LocalRunner` and
`DockerRunner`), wrapping StackBlitz's `@webcontainer/api`. It runs untrusted,
agent-authored code entirely inside a browser tab: an in-browser Node runtime, an
isolated filesystem, and an instant `preview()` URL for a dev server, with nothing
touching the host. This is the "sit on harnesses, don't compete" bet for the
browser: the same `Runner` interface, now backed by WebContainer.

It is browser-only by construction (WebContainer needs `SharedArrayBuffer`, so the
hosting page must be cross-origin isolated), so `@webcontainer/api` is an optional
peer dependency and is imported lazily: loading `@gemstack/ai-autopilot` in Node
never pulls it in. Guard with the new `webContainerAvailable()` and reach for
`DockerRunner` on the server.

Because a WebContainer cannot boot in Node, boot-and-serve is proven by a headless
Chromium harness under `packages/ai-autopilot/harness/webcontainer/` that drives
the compiled adapter through boot, fs, exec (exit codes, cwd/env, timeout kill),
start, a real preview URL, an in-container serve check, dispose, and reboot. The
Node-only guards are covered by the default test suite.

Part of #109 (the Flue adapter stays gated on a live Flue environment).
