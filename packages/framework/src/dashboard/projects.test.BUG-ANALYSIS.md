# Bug analysis: packages/framework/src/dashboard/projects.test.ts

## Business logic (high-level)

Pins `summarizeProject` exactly as its test SPEC describes: name from the path basename (plus id/path passthrough); `lastActivityAt` from the newest agent (#645 — the LOGS.md re-narration is gone); no-agents → no key at all; activation reflects the injected check; throwing readers degrade to inactive/no-activity without throwing; the #842 `fileConfig` carry (present when set, absent when `{}`, and an unreadable yml leaves the rest of the summary intact).

`defaultProjectsProvider` is deliberately untested (it would touch the user's real registry) — the provider is trivial glue; acceptable boundary, noted.

## Functions (low-level)

- **`RECORD` / `deps(over)` / `agent(id, updatedAt)`** — `deps` supplies benign defaults so each test overrides only its subject; `agent` sets `startedAt = updatedAt`, which means the `updatedAt || startedAt` fallback branch is never distinguished — a run with only `startedAt` is uncovered (coverage note, the production `.filter(Boolean)` handles it).
- **"derives name from the path basename"** — asserts name/id/path. Correct.
- **"lastActivityAt is the newest run (#645)"** — two runs out of order; expects the later. Correct (also proves sort not first-element).
- **"no runs means no lastActivityAt key at all"** — `in` check pins key omission (matters for JSON payload shape). Correct.
- **"activation reflects the injected check"** — false case. Correct.
- **"a throwing reader is forgiving"** — both `isActivated` and `readAgents` throw; asserts degraded summary. The yml reader default (`async () => ({})`) still succeeds here, so the all-three-failing combination is implied by the separate yml test — fine.
- **#842 trio** — carries a config verbatim (`deepEqual`), omits the key for `{}` (`in` check), and an `EACCES` read leaves name intact with `fileConfig` undefined. Correct; all assertions can fail.

## Bugs found

None found.
