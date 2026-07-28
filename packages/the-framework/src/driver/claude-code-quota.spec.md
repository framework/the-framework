Reads the account's Claude subscription quota (#521) by running the Claude Code CLI's `/usage` command in print mode and parsing its prose readout.

## TLDR

- `readClaudeQuota()` spawns `claude -p /usage --output-format json` (20s timeout), unwraps the JSON envelope, and hands `result` to `parseQuotaReadout`.
- `parseQuotaReadout(text)` extracts every `"<label>: <n>% used · resets <when>"` line into `DriverQuotaWindow`s (kind: `session` / `week` / `week-model` / `unknown`).
- Failure reasons are typed: ENOENT → `agent-not-found`, non-zero exit or `is_error` → `fetch-failed`, timeout/abort → `timeout`, unparseable → `unrecognized`, no windows and no subscription header → `no-subscription`.

## Problems

- The readout is prose, so a reworded CLI is a real failure mode: it fails to `unrecognized` rather than to an empty reading — a silent zero would read as "nothing used" and let a consumption limit run the account dry.
- Distinguishing "no subscription" from "parse failed": the header tail `to power your Claude Code usage` appears in both subscription phrasings (normal and mid-overage) and in neither non-subscription case; keying on the word "subscription" would misread an account burning overage as having no quota.
- The window regex is anchored and strict (`% used` right after the colon) because the readout carries near-matching lines (`Top skills: ...`, `70% of your usage was at >150k context`).

## Facts

- The read costs nothing: verified on CLI 2.1.210 as `total_cost_usd: 0` — the CLI answers locally. It uses the CLI's own credentials, so The Framework never handles the user's token.
- Never pass `--bare`: it pins the CLI to API-key auth and the subscription quota vanishes.
- The timeout timer is deliberately not unref'd: it is the only thing guaranteeing the promise settles.
