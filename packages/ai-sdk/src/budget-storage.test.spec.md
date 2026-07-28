Tests for `budget/storage.ts` — `periodKey` timezone-aware formatting and `memoryBudgetStorage`'s atomic check-and-debit.

## TLDR

- `periodKey`: daily `YYYY-MM-DD` / monthly `YYYY-MM`, UTC by default; an IANA timezone shifts day and even month boundaries (PST vs UTC).
- `checkAndDebit`: allows when `spent + cost ≤ cap` (inclusive); denial leaves `spent` at the pre-debit value; `costUsd: 0` is a pure non-mutating read; buckets isolate per (userId, period); counters roll at the (timezone-local) midnight/month boundary.
- Validation rejects negative/NaN/Infinity cap and cost.
- Atomicity: 100 concurrent debits at the cap line allow exactly `floor(cap/cost)`; mixed concurrent costs never exceed the cap in total.

## Facts

- The concurrency test deliberately uses cost 0.5 / cap 4 because 0.5 is an exact IEEE 754 fraction — 0.1/0.05-style values accumulate float error (4.0000000000000004) and would deny one valid debit.
