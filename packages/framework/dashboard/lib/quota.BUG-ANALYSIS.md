# Bug analysis: packages/framework/dashboard/lib/quota.ts

## Business logic (high-level)

Two thin polling hooks feeding the usage panel (#535/#1161): `useQuota` and `useAutoPm`, each `usePolled(rpc, undefined, 30_000, [])`. All SPEC obligations — undefined-until-first-answer, keep-last-on-failure, 30s cadence, stop-on-unmount, prerender-empty — are delegated to `use-async.ts`'s `usePolled`, which implements them (verified in its own analysis); this file adds only the RPC bindings and the constant.

Edge cases: deps `[]` are correct — neither load closes over anything changeable. `undefined` as the initial value means the panel cannot distinguish "not asked yet" from "host reports nothing", which is fine for both uses (the panel just renders nothing until an answer, and `useAutoPm`'s SPEC explicitly says "undefined on a host with no sweep" — a host with no sweep presumably answers undefined/null over the RPC, which `usePolled` then stores; either way undefined renders as absent). Two components mounting both hooks poll independently (two 30s timers) — cheap by design ("the daemon already keeps a cached reading").

## Functions (low-level)

- `REFRESH_MS` — 30s; matches the SPEC's "every thirty seconds". Correct.
- `useQuota()` — `usePolled<QuotaView | undefined>(onQuota, undefined, REFRESH_MS, []).value`. Failure keeps last (delegated); unmount stops polling (delegated). Verdict: correct.
- `useAutoPm()` — identical shape over `onAutoPm`. Verdict: correct.

## Bugs found

None found.
