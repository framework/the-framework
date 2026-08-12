Lets teams test their agents the way they test code.

A suite declares cases — each an input plus an assertion — pointed at the very agent instances the app ships, so there is one source of truth. The runner executes them and judges each answer by exact text, pattern, JSON structure, semantic similarity, token budget, or an LLM judge that grades a plain-language criterion; every case rolls up pass/fail, duration, tokens, and dollars via the shared price catalog (an unknown model costs zero rather than crashing a report). Results print to the console, export as stable JSON for CI, or render as a self-contained HTML page. Real provider runs can also be recorded to disk and replayed later, turning expensive live evals into free deterministic regression tests.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
