# Bug analysis: packages/framework/src/driver/index.ts

## Business logic (high-level)

A pure re-export barrel: the public face of the driver subsystem for the rest of the package. It has
no runtime logic beyond module linking, so the only defects it can carry are *surface* defects —
exporting something internal that then becomes hard to remove, or failing to export something a
consumer needs (which would be a compile error, not a runtime one).

What it offers, checked against `index.SPEC.md` ("the driver contract itself, the four drivers that
satisfy it (Claude Code, Codex, the `actions` run target, the `web` run target), the fake driver,
and reading where the account's quota stands"):

- The contract types from `types.js` (`Driver`, `DriverSession`, start/prompt options, turn, event,
  usage, rate limit, and the four quota types) plus the one value from that module,
  `isTransientQuotaReason`.
- The quota read: `readClaudeQuota`, `parseQuotaReadout`, `ReadClaudeQuotaOptions`.
- Five driver implementations, matching the directory SPEC's "One seam, five implementations":
  `FakeDriver`, `CodexDriver`, `ClaudeCodeDriver`, `ActionsDriver`, `CloudDriver` — each with its
  session class, options type, and (where useful) its parser/replay helper.
- The shared process engine `runCliSession` and its four types, so a future driver can be written
  outside this directory.

Every re-exported name was checked to exist at its source module (`actions.ts` L34/L47/L91/L99/L291,
`cloud.ts` L38/L54/L64/L107, `claude-code-quota.ts` L45/L96, `fake.ts`, `codex.ts`,
`claude-code.ts`, `cli-session.ts`, `types.ts`) — no dangling or renamed export. The barrel is used
by roughly twenty modules across the package (`agent.ts`, `agent-driver.ts`, `driver-cli.ts`,
`cli.ts`, `quota-poller.ts`, `terminal.ts`, `events.ts`, tests, …), so it is live surface, not dead
code.

**Deliberate omissions, all correct.** `session-support.js` (internal helpers shared by the CLI
drivers) and `child-registry.js` (process-group bookkeeping, whose only importer is
`cli-session.ts`) are not re-exported — nothing outside the directory needs either.
`readZip`/`ZipEntry` are excluded with an explicit #947 rationale.

**Stale comment (not a bug).** The L29-33 rationale describes `readZip` having "rode this barrel
onto the published surface via `src/index.ts`'s `export *`". `src/index.ts` no longer contains any
`export *` (verified: zero matches in its 43 lines), so the mechanism it warns about is gone. The
conclusion — don't re-export an internal zip reader — still stands, and a stale explanatory comment
is not a behavioural defect.

**Circularity / load order.** `claude-code.ts` and `codex.ts` import `cli-session.js` and
`session-support.js` by path, not through this barrel, so importing the barrel does not create a
cycle. All exports are static; there is no side-effecting module in the graph (the drivers only
define classes at load time), so importing this file cannot spawn anything.

## Functions (low-level)

No functions, hooks, components, or constants are defined here — every statement is an
`export … from`. The `export type { … }` blocks are type-only, so they are erased at build time and
cannot cause a runtime resolution failure; the value exports (`isTransientQuotaReason`,
`readClaudeQuota`, `parseQuotaReadout`, the five driver classes, the session classes, the two
parsers, `runClaude`, `replayTranscript`, `runCliSession`) all resolve. Verdict: correct.

## Bugs found

None found.
