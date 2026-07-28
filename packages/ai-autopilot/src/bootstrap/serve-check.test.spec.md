Tests for `serve-check.ts` — boots real one-line `node:http` servers on free ports via `LocalRunner` (pass, 500 response, exit-before-serving) and uses `FakeRunner` for the install-failure and no-start/preview-capability paths; also covers `mergeChecklists` union/dedupe and all-clean gating.

## Facts

- The 500-status case asserts the check distinguishes "served an error" (`responded 500`) from "did not serve"; a runner built with `background: false` yields the skip verdict (`blockers: []` + a `skipped` note).
