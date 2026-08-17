Effort: 6
Uncertainty: 6

# [Plan] Web runs: drive claude.ai sessions through the browser extension instead of claude --cloud

Half of this ticket already exists on the unmerged branch `suleimansh/feat/1328-extension-sessions`, but the ticket's motivating premise collapsed on 2026-08-17 — `--cloud` now works end to end — so the first step is a maintainer decision on whether this is still worth building, and the rest is a staged port of that branch onto today's main.

## TLDR

- **The premise changed since filing.** The ticket says `--cloud` is "currently broken outright" (#1320). #1320 was closed 2026-08-17: #1544 fixed provisioning (repo-bound sessions that can push) and #1518 fixed the behavior side — a "Run on: Claude web" launcher run now goes hand-off → merged PR with no human step (first evidence: PR #1546, and #1327's thread calls the delivery blocker cleared). The *strategic* rationale survives (`--cloud` is a removable CLI flag; today's fix leans on an undocumented `--ref` flag plus a disabled statsig experiment that `driver/cloud.ts` itself says to drop "once the upstream preflight" changes — i.e. the working path is held together by two unofficial mechanisms), but the *urgency* rationale is gone.
- **A working prototype exists and is stale in a specific, known way.** `suleimansh/feat/1328-extension-sessions` (2 commits, 2026-07-28) has the daemon start-queue (`bridge-starts.ts` + `GET /_bridge/start` + `POST /_bridge/started`, with tests) and the extension's `createSession`/`probeNewSession` page flow (with jsdom fixtures in `check.mjs`). The daemon half ports nearly clean; the extension half was written against `spike/cc-web-extension/content.js`, and the extension has since moved to `packages/chrome-extension/` at v0.8.0 with a strict daemon-side version gate (#1519), so that half must be re-homed, not rebased.
- **What was never built:** the CloudDriver extension-backed mode (the driver never learned to enqueue a start and resolve on the report), the fallback rule between the two paths, the concurrency story (#1327 wants 10 sessions; the bridge caps watched tabs at 3 by choice), and the #610 policy reversal on the record.
- **Recommendation:** get the direction decision first (build / park / build-as-fallback), and if building, land it in the staged order below — daemon queue, extension port, driver mode, then the concurrency spike — keeping `--cloud` as the no-extension fallback exactly as the ticket sketches.

## What changed since the ticket was written (read this first)

| Ticket premise (2026-07-27/28) | Reality (2026-08-17) |
| --- | --- |
| `--cloud` broken on at least one account: every session bundles, can never push (#1320) | #1320 **closed**. `CLOUD_ENV` in `driver/cloud.ts` disables the statsig bundle experiment; `--ref` + the driver's pre-hand-off push pin a fetchable branch. Runs land their own PRs (PR #1546, 39s after hand-off). |
| Extension is the only working path to a pushing web session | Extension is the *more observable* path; `--cloud` is a working but fragile path (undocumented flag + "drop this once upstream changes" env toggle) |
| #1327's 10-agent fan-out blocked on delivery | #1327 unblocked on delivery; what it still lacks is fan-out + locks, not this ticket |

The maintainer direction ("invest in the extension, not `--cloud`") predates all of that, and issue #1328 has had no activity since filing. This plan does not assume the direction is dead — the removable-flag argument and the observability argument both still stand — but building multi-week UI-automation infrastructure to route around a bug that no longer exists is a decision to re-take, not to inherit.

## What already exists

**On main today:**
- The full bridge: token-gated `/_bridge/*` endpoints (`dashboard/bridge-endpoints.ts`), transcript mirroring, question/answer delivery, watched-tab management (`bridge-sessions.ts`, 3-tab cap, 12h window), and a version gate (`EXPECTED_EXTENSION_VERSION = '0.8.0'`) that 426s any skewed extension.
- The extension at `packages/chrome-extension/` (v0.8.0): reads questions, mirrors transcripts, types answers into the composer, keeps one pinned tab per watched session — i.e. every DOM-driving primitive session creation needs except the new-session flow itself.
- `CloudDriver`/`CloudSession` (`driver/cloud.ts`): the one-hand-off-per-agent contract, the pre-hand-off push of `HEAD:refs/heads/<agent-id>`, the session-URL detection, trust-prompt detection, and the `report()` shape that feeds the dashboard.

**On `suleimansh/feat/1328-extension-sessions` (unmerged, based ~2026-07-28, main has moved ~50+ commits):**
- `dashboard/bridge-starts.ts` (186 lines + 113 lines of tests): an in-memory start-queue with a real state machine (`queued → claimed → created | failed`), claim-on-read so two tabs cannot double-create, a 90s claim TTL so a browser quitting mid-creation retries, and hard validation (repo `owner/name` with dot-traversal check, branch charset, prompt cap). Its key design point is worth preserving verbatim: **the daemon is the producer** — the extension posts back only an id, a boolean and a session id, so the bridge's "no free text inbound" security property is unchanged.
- `GET /_bridge/start` + `POST /_bridge/started` wired into `bridge-endpoints.ts` and `server.ts` (+94 lines of endpoint tests).
- `createSession` + `probeNewSession` in the extension's page half (177 lines): drives repo picker → branch picker → composer → send, reads the session id from the resulting URL; `probeNewSession` describes the page's controls without touching them so the first live run diagnoses instead of failing. Eight jsdom fixture cases in `check.mjs`, which also caught and fixed a real bug (contains-matching in `pickFromMenu` let a repo trigger satisfy a branch check).
- **Stale in these ways:** the page-half work targets `spike/cc-web-extension/` which no longer hosts the shipped extension; the branch predates the version gate (#1519), the events mirror, and the answer-delivery hardening; and its module comment states the now-false #1320 rationale.

## Problems

### 1. Is this still the right investment? — uncertainty 8

The decision input changed under the ticket. Options, in the order I would present them:

1. **Build it, as the durable path (the standing direction).** Arguments: `--cloud` can vanish in any CLI release; the current `--cloud` fix depends on `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` suppressing a server-side experiment (explicitly temporary per the code comment) and on the undocumented `--ref` flag; the extension path gives per-step observability (`probeNewSession`, report-status) that a pty scrape never will; and the mirror/answer machinery means an extension-created session is a *watched* session from birth.
2. **Park the ticket, demote priority.** Arguments: `--cloud` works today and is dramatically simpler; the extension path inherits every DOM-fragility risk the v0.7 lessons list; #1327 (the goal this serves) is no longer blocked on it. Cost of parking: if upstream removes `--cloud` or re-enables the bundle experiment, web runs die with no fallback ready.
3. **Build it as the *fallback*, inverting the ticket's sketch.** `--cloud` stays primary; the extension mode exists behind the same driver so a `--cloud` breakage is a config flip, not an outage. This buys the insurance of option 1 at the same build cost but lower operational risk (the fragile DOM path runs rarely instead of always).

This is the maintainer's call (it is their recorded direction being questioned); the plan below is written so stages 1–2 are worth landing under options 1 *and* 3, and only stage 3+ depends on which is chosen. **Recommended: option 3** — it honors the direction, keeps the working path primary, and makes the DOM path's fragility a dormant risk instead of a live one.

### 2. The #610 policy reversal must be recorded — uncertainty 2

`driver/cloud.ts:13-19` still states that browser/extension/scraping approaches are "ruled out by the Usage Policy". The ticket itself asks for the reversal to be deliberate and on the record. The narrow reading (per the headless-spike plan): the extension is user-installed, acts inside the user's own logged-in browser, automates exactly the user's own clicks — *headed and attended*. Record that in `MEMORY.md` (Decisions) when stage 1 lands, rewrite the `driver/cloud.ts` header, and note the boundary explicitly: headless/unattended/UA-spoofed operation is a *separate* decision that #1332's spike plan already flags as materially different. Low uncertainty on the *how*; the *whether* is problem 1.

### 3. How the driver's extension mode resolves — uncertainty 4

`CloudSession` resolves its one hand-off when the session URL appears in pty output. The extension mode must mirror the same contract (one hand-off per agent; later prompts report, never re-create):

- `prompt()` enqueues a `BridgeStartInput` (repo from the agent's origin remote, branch = the already-pushed `refs/heads/<agent-id>`, prompt = `cloudHandOffPrompt(...)` output) and awaits the queue entry reaching `created`/`failed`, with a timeout.
- The existing pre-hand-off push (#1320's `HEAD:refs/heads/<agent-id>`) is reused as-is — the branch picker needs the branch on origin, and slash-free agent ids dodge the branch-picker equivalent of anthropics/claude-code#87235. In extension mode a failed push should probably *fail* the hand-off rather than degrade (the picker cannot pick a branch that is not there; `--cloud` could at least fall back to its default pin).
- On `created`, report exactly as today (`action: cloud <url>`, result with `sessionId`/`sessionLink`) — everything downstream (agent meta join, `bridgeSessionsFrom` opening a watch tab, mirror, answers) then works unmodified, because it keys on `sessionId`.
- Open sub-question: does a *creation* need its own tab lifecycle or does the creation tab become the watch tab? Simplest: the extension navigates a pinned tab to `claude.ai/code` (new-session page), drives the flow, and the tab *is* then on `/code/session_<id>` — precisely what `openWatchedTabs` matches. One tab, no handover.

### 4. When to use which path — uncertainty 5

The fallback rule the ticket sketches ("`--cloud` as the no-extension fallback") needs a trigger. Alternatives:

1. **Bridge liveness**: the daemon already records bridge contact (`contact`/`extensionVersion` handlers). If an up-to-date extension polled within N minutes, use the extension path, else `--cloud`. Automatic, no new UI, degrades correctly when the browser is closed. Risk: a browser that dies mid-creation burns the claim TTL (90s) before falling back — acceptable.
2. **Explicit dashboard setting** ("Create web sessions via: extension | CLI"): predictable, but one more knob and a stale-setting failure mode.
3. **Try-then-fallback**: enqueue with a short timeout, fall back to `--cloud` on expiry. Cleanest UX, but a slow-but-alive extension can double-create — needs the queue entry cancelled before the fallback fires (the state machine supports this: only fall back from `queued`, never from `claimed`).

Recommended: 1, with 3's cancel-before-fallback guard for the enqueue-timeout case. (Under problem 1's option 3, invert it: `--cloud` primary, extension used when `--cloud` fails or by setting.)

### 5. Concurrency (#1327's 10 sessions) — uncertainty 6

Ten parallel creations = ten simultaneous DOM flows plus ten watched tabs against a deliberate 3-tab cap (`BRIDGE_SESSION_LIMIT`). Unknowns nobody has measured: does claude.ai rate-limit rapid session creation; do ten background tabs' throttled timers make the composer waits flake; does the tab-storm bug (found by the #1332 spike: a watched tab landing off `/code/session_*` triggers unbounded re-opens) amplify under load. This needs its own spike *after* single-session creation works headed — do not let #1327 ride on it before that spike runs. Serializing creations (the claim-on-read queue already yields one at a time per poll beat) while parallelizing *watching* is the likely landing point, and raising the tab cap is a deliberate decision to re-take then, not a constant to bump in passing.

### 6. DOM fragility — uncertainty 4 (known, mitigated, not removable)

The v0.7 lessons (composer render races, tab revival, DOM changes) apply in full to a much longer interaction than answer-typing. Mitigations already in the prototype: `probeNewSession` (diagnose before driving), per-step failure naming, jsdom fixtures pinning the *flow* rather than the markup, and the version gate keeping daemon/extension skew loud. Accept the residual risk; it is the price of the path and the reason problem 4's fallback must stay wired.

## Considerations

- **The in-memory queue is correct, not a shortcut**: a start surviving a daemon restart would create sessions for runs that no longer exist, spending real quota. Same argument as the questions store.
- **Version gate discipline**: porting the extension half means bumping `manifest.json` and `EXPECTED_EXTENSION_VERSION` together (a test pins them in lockstep) and shipping both sides in one release — a skewed pair 426s by design.
- **Session-id validation** on `/_bridge/started` must reuse the `SESSION_ID` regex; the reported id is joined into agent meta and becomes a URL the dashboard opens.
- **`bridge-starts.ts`'s module comment** must be rewritten on port — it states the dead #1320 rationale as present-tense fact.
- **Headless/#1332 interplay**: that spike's own plan says to land and stabilize *headed* session creation first, because creation is a long DOM interaction on throttled background-tab timers. This plan agrees; nothing here assumes headless.
- **Related open tickets**: `2026-08-03_cc-web-select-repos.md` (repo scoping) touches the same picker; `2026-07-26_choices-not-working-cc-web.md` and the tab-storm fix (recommended as its own ticket by the #1332 plan) share the extension surface. Check locks before touching shared files.
- **Quota**: every live end-to-end test creates a real cloud session on the user's account. The jsdom fixtures exist precisely so iteration is free; live runs should be single, deliberate probes.

## Implementation

Staged so the decision gates the expensive half, and so stages 1–2 are worth having under both "primary" and "fallback" outcomes.

1. **Decision checkpoint (problem 1) + record it.** Comment on #1328 with the premise change; get build/park/fallback chosen. If "park": close this plan out by demoting the ticket's priority, done. Otherwise: add the #610-reversal decision to `MEMORY.md` and fix the `driver/cloud.ts` header (problem 2).
2. **Port the daemon half** of `suleimansh/feat/1328-extension-sessions` onto main: `bridge-starts.ts` + tests, `/_bridge/start` + `/_bridge/started` endpoints + tests, `server.ts`/`index.ts` wiring. Files are additive and barely conflict; rewrite the module comment. (Effort ~1)
3. **Re-home the page half**: port `createSession`/`probeNewSession` into `packages/chrome-extension/content.js`, the start-poll into `background.js` (ride the existing answers alarm beat), and the eight fixtures into `check.mjs`; bump extension + expected version together. Verify selectors against today's claude.ai via `probeNewSession` before any live drive. (Effort ~2, the DOM re-verification is the real work)
4. **CloudDriver extension mode** (problem 3): enqueue-and-await inside the existing one-hand-off `CloudSession` contract, path selection per problem 4's rule, push-failure = hand-off failure in extension mode, report shape unchanged. (Effort ~2)
5. **One live probe**: single ticket, single session, headed browser — probe, create, confirm the created session is watched, mirrored, answerable, and lands a PR. Fix what it surfaces.
6. **Concurrency spike** (problem 5) under its own ticket before #1327 depends on this: 3 then 10 serialized creations, measure creation latency and tab behavior, then decide the tab cap.
