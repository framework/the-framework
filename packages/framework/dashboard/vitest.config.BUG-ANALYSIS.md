# Bug analysis: packages/framework/dashboard/vitest.config.ts

## Business logic (high-level)

The dashboard's unit-test config, deliberately separate from `vite.config.ts` so the dev-daemon
and Tailwind plugins never load under vitest (documented). Checked:

- `root` pinned to this directory — the include globs (`**/*.test.ts(x)`) resolve against the
  dashboard dir even though the package scripts run one level up (`cd dashboard && vitest run`
  in package.json actually cds in as well; the pin makes it correct from either cwd).
- `environment: 'jsdom'`, `globals: true`, setupFiles wiring `vitest.setup.ts` — consistent with
  the tests (they import `describe/test` explicitly anyway, so `globals` is belt-and-braces).
- `exclude: ['node_modules/**', 'dist/**']` — replaces vitest's defaults; adequate here since the
  only test files under this root are the dashboard's own. `dist/**` covers a stray build.
- `testTimeout: 20_000` vs the setup file's 5s `asyncUtilTimeout` — the ordering argument in the
  comment holds: a query that hits its 5s ceiling fails with the element it waited for, well
  inside the 20s test budget, instead of vitest's timeout naming nothing. Coherent pair.
- Only the React plugin is loaded — the JSX transform is indeed all the unit tests need; Tailwind
  absence just means unstyled DOM, which no test asserts on.

## Functions (low-level)

- default export (`defineConfig`) — configuration only; no logic to misfire. Verdict: correct.

## Bugs found

None found.
