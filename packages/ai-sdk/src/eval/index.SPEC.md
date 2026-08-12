The eval framework's core: declare cases as input plus assertion, run them against the same agents the app ships, and get pass/fail with cost and token totals.

## TLDR

- Built-in assertions range from exact and pattern matching to structural JSON checks, embedding-similarity, and token budgets, plus an LLM judge that grades a plain-language criterion and explains its verdict; assertions compose, and any custom check works too.
- A broken judge or embedding call counts as a failure, never a pass.
- Judge and embedding usage is folded into the case's own cost, so reports show what a case really cost.
- The runner never throws: agent errors, assertion throws, and timeouts all become failed cases, and cases can be skipped with a reason.
- Cases run one after another — correct under any provider rate limit — and each completion is announced to observers.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
