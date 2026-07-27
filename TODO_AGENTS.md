# TODO_AGENTS

## Priority 8

- [Settle-moment UX: always offer `Open PR`, auto-commit, no-diff guard](tickets/2026-07-25_unclear-ux-what-now.md) — implement the in-thread maintainer decisions: default `[x] Open PR`; unattended runs commit their work automatically (safe: every run is on its own branch); when the branch has no diff, don't offer `Open PR` — say so and name the uncommitted work; launcher gear reduced to one `Open PR` row (the push setting stays available in `the-framework.yml` and the CLI flag). The `Auto commit`/`Auto push` settings split is explicitly postponed — do not add settings.
- [Remove the "do NOT re-scaffold" babysitting paragraph from the system prompt](tickets/2026-07-26_remove-ugly-babysitting.md) — delete the paragraph at `packages/the-framework/src/steps.ts:62` and update the assertions in `packages/the-framework/src/steps.test.ts` (~lines 198 and 227) that match on its text.

## Priority 7

- [Retry runs killed by transient API drops](tickets/2026-07-27_transient-api-drop-kills-run.md) — when a child exits nonzero with a driver-level transient error (connection drop, 5xx, rate-limit), retry once or twice with backoff by continuing the same run in its retained worktree, before declaring `failed` (reuse #923's `--continue-run` resume; #1278 made the recorded branch reliable). A run failing the same way after retries stays `failed`.
- [Heal main-checkout workspace links at worktree teardown](tickets/2026-07-27_main-checkout-links-into-run-worktree.md) — when a run worktree is removed, scan the project root's dependency symlinks for targets inside the removed worktree and re-point them at the root's own sibling paths. In-thread analysis assessed prevention and ruled it out (no pnpm knob; real dirs cost the disk #736 avoids) — build the recommended teardown healing only.

## Priority 5

- [Show agent error messages in red in the session log](tickets/2026-07-25_show-agent-error-red.md) — maintainer pre-authorized this for autonomous AI pickup ("only if quick-win"); bail out and report if it turns out non-trivial.
- [Highlight the user prompt on the run page](tickets/2026-07-25_where-see-user-prompt.md) — highlight the sent user prompt (the text next to `YOU`) in blue; additionally show it as the first log entry if that stays trivial ("only if quick-win").
- [Surface the prompt analysis in the dashboard](tickets/2026-07-25_show-prompt-analysis.md) — on the run page, show from the run's `ANALYSIS_RESULT.md`: Scope (one word), Variability (one word), Plan yes/no (label "Whether the work includes a plan"), New tickets yes/no (label "Whether the work spans over new tickets"). Parse tolerantly and hide fields that are absent; maintainer pre-authorized this for autonomous AI pickup ("only if quick-win").
- [Fix the empty dropdown at the bottom of the settings UI](tickets/2026-07-25_empty-settings-dropdown.md) — diagnose why an empty dropdown renders; either give it its intended content or stop rendering it (the ticket accepts both outcomes).

## Priority 2

- [Drop readZip/ZipEntry from the public API barrel](tickets/2026-07-21_readzip-leaks-onto-public-api.md) — mark both `@internal` in `driver/actions-zip.ts` and remove the re-export at `packages/the-framework/src/driver/index.ts:29`. Nothing has shipped to npm (#746 still open) and the only importer is `actions-zip.test.ts`, which imports the module directly — the removal breaks no consumer.
- [Honor the XDG spec default for the global store path](tickets/2026-07-25_global-store-one-file-or-folder.md) — in `registryPath()`, use `~/.config/the-framework.json` even when `XDG_CONFIG_HOME` is unset (the spec default), with a migration read of the legacy `~/.the-framework.json`. Scoped to this fix only ("worth doing either way" per the ticket) — the file-vs-folder question stays open, do not restructure the store.
