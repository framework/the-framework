Telefunc endpoint shims: every `.telefunc.ts` here only re-exports implementations from `@gemstack/the-framework/dashboard-rpc` — the file path itself is the contract.

## TLDR

- `control.telefunc.ts` — steering: stop/choice/message/start, bridge answers, handoff, preview/serve, open-in-app, worktree/session removal, push branch, open PR, queue ticket (#405).
- `devices.telefunc.ts` — `checkDevices` saved-devices health (#1072).
- `events.telefunc.ts` — `onEvents`, the live-event Channel (#405).
- `preferences.telefunc.ts` — user/project preferences, presets, editors, notify channels, Discord credentials (+ type re-exports) (#410).
- `projects.telefunc.ts` — projects list, add project, onboarding, Claude trust (#405).
- `quota.telefunc.ts` — usage panel: quota, auto-PM (#535).
- `reads.telefunc.ts` — the ~30 read-model functions: runs, docs, tickets, git/diffs, bridge, aggregates (#405).
- `shims.test.ts` — source-shape guard for the #1014 re-export rule.

## Facts

- The file path bakes the RPC key: the telefunc Vite transform turns these exports into client stubs keyed `/server/<name>.telefunc.ts` — the exact keys the daemon registers the impls under (framework's `dashboard-rpc/register.ts`). Renaming/moving a shim silently breaks the daemon pairing.
- All shims import-then-export instead of `export ... from` (#1014): telefunc's dev transform appends `__decorateTelefunction(<name>, ...)` per export, which needs a local binding that `export ... from` does not create; only type re-exports are exempt. `shims.test.ts` enforces this.
- Implementations live in `@gemstack/the-framework` so the daemon serves them in-process against the files it writes; plain `pnpm dev` has no daemon context (e.g. `sendStart` reports it is not enabled) unless `pnpm dev:daemon` proxies `/_telefunc` to a real daemon (see `vite.config.ts`).
