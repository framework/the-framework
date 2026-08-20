Dev-server and build setup for the dashboard: a plain Vite SPA, entered from the `index.html` beside it.

## Flows

- The build writes the bundle straight into the package's `dist/`, where the daemon serves it from.
- An opt-in dev mode brings up a real daemon and forwards the dashboard's calls to it, so starting agents works from the live-reload UI (the plain dev server can only read).

## Rationales

- The root is pinned to this directory rather than inherited from the cwd, because the scripts that run it live in the package root one level up.
- The dev mode is the only thing here that wants the package's build rather than its source: it runs in this file's own Node process, outside any transform, so it imports the built entry — typed against the source it is built from, so a signature change is still caught.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
