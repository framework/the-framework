Tests that the compiled main entry (`dist/`, minus `dist/node/`) contains zero Node-only static imports (`node:*`, `fs`, `path`, `crypto`, …) and that the `/node` subpath exists.

## Facts

- Scans built `dist/*.js` files with a regex, so it fails with a "run `pnpm build` first" message when `dist/` is missing — the check guards the runtime-agnostic (browser/RN/edge) guarantee of the main entry.
