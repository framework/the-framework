---
'@gemstack/the-framework': minor
---

The built-in production-grade checklist is gone (#1372): a run with no domain preset and no `--serve` config now ends when the build turn ends — no app-wide review re-prompts, no `{ blockers }` outcome gate looping after the work is done. The principle (agreed on Discord 2026-07-29): the wrapped agent is a clever black box; The Framework doesn't babysit it or tell it "make it production-grade" — quality prompts layered on top can conflict with the agent's own system prompt, and improving the agent is its vendor's job. Reviews still run where the user asked for them: a domain preset's loop drives the checklist as before, and the boot-and-serve gate still mechanically verifies the app runs. A preset with no loop for the build event now reviews nothing instead of falling back to the removed built-in checklist.

The `set-scope` signal goes with it: the protocol section, `parseScopeVerdict`, the `scope-verdict` event, and the run's small-scope skip existed only to spare trivial runs from that review (#1356/#1358), and with no default gate there is nothing to skip. `extendPrompt` no longer asks for the verdict.

Two seams moved to keep behavior honest: the budget/quota/decline controls used to be observed by the review phase after the build — with that phase gone the build step and the run now check the abort signal themselves, so a stopped run still ends as *stopped* instead of settling as done; and the CLI/terminal/dashboard now say plain "done" for a run that configured no review, instead of the misleading "prototype ready".

Removed exports: `PRODUCTION_GRADE_PROMPT`, `driverChecklist`, `MISSING_VERDICT_BLOCKER`, `parseScopeVerdict`, `ScopeVerdict`, the `scope-verdict` `FrameworkEvent`, and `domainLoopChecklist`'s `fallback` option.
