`detectMaterialChange` — the deterministic, path-driven detector deciding whether a `LoopEvent` is structural enough to refresh `CODE-OVERVIEW.md`.

## TLDR

- Signals, each contributing a human-readable reason: build/config file touched (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig*.json`, `vite/rollup/webpack/esbuild/astro/svelte/nuxt/next.config.*`, any `*.config.[cm]?[jt]s`); test-tooling touched (`vitest/jest/playwright/cypress/karma/ava.config.*`, `jest.setup.*`); caller-supplied `extraPatterns`; a large change (≥ `manyFilesThreshold`, default 8 files) spread across ≥2 distinct top-level directories; restructure keywords in `event.summary` (restructur/reorganiz/migrat/rename/move/scaffold/new module|package|area|service).
- Returns `{ material: reasons.length > 0, reasons }` — pure and deterministic: same event in, same verdict out.

## Decisions

- Deterministic and path-driven (no model call) so it is cheap enough to run on every loop event; the module doc says the signals were validated against Cloudflare's published reviewer, which hit the same "instructions rot fast" problem.
- The many-files signal requires files in ≥2 top-level areas — a big change confined to one area does not reshape the structure section, so it is not material.

## Facts

- `topDir()` returns `undefined` for root-level files, so they never count toward the distinct-areas set.
