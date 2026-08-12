The built-in framework presets — Vike, the flagship, and Next.js — plus the registry that holds presets and picks the one a run should use.

## TLDR

- Vike is recognized by its packages and its distinctive plus-prefixed page/config files; Next.js by its package and its config and app-directory files.
- The registry accepts extra presets (say, a project's own framework) and detects among everything registered.
- Selection always yields a preset — the detected one, else a chosen fallback, else the flagship — so a run has one even on an empty or unrecognized project, while the detection result stays honest that nothing matched.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
