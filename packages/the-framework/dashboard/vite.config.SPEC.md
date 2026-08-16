Dev-server and build setup for the dashboard: a plain Vite SPA, entered from the `index.html` beside it. Its root is pinned to this directory rather than inherited from the cwd, because the scripts that run it live in the package root one level up; the build writes the prerendered bundle straight into that package's `dist/`, where the daemon serves it from, which is what used to be a separate copy step. Its one behavior of note is an opt-in dev mode that brings up a real daemon and forwards the dashboard's calls to it, so starting agents works from the live-reload UI (the plain dev server can only read).

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
