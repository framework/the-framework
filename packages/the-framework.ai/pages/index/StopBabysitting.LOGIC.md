The "Stop babysitting" chapter: the site's argument, as five "Problem" cards that each name a way AI lets its user down, the "Bad fix" people try (marked 😕), and The Framework's "Solution" rows (marked 🚀). This chapter carries the site's core claims about what The Framework does against lazy, presumptuous and forgetful AI.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control.
[2] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.

## Business logic — TL;DR

- **"AI is lazy"** - appending "DON'T BE LAZY" to prompts brings minimal improvement; The Framework instead applies "Divide-and-conquer" (it instructs AI to split large tasks into smaller subtasks, so that AI spends more effort overall and produces much higher-quality output) and "Coverage guarantees" (AI enumerates everything that needs to be done before writing code, then works through that checklist, which prevents lazy shortcuts).
- **"Lazy AI plans"** - explicitly telling AI to deep dive the important aspects is the bad fix; the solution is an automatic loop of critical feedback, research, confidence and implementation.
- **"Lazy low-quality code"** - AI can write high-quality code but often goes for the quickest solution (not correct, not maintainable, not DRY); appending "WRITE CLEAN CODE" brings minimal improvement; instead, when an agent [1] makes complex changes it adds post-merge refactoring prompts to the "AI Queue" with low priority, and routine security and code quality prompts run automatically when the usage quota [2] has plenty of capacity.
- **"AI makes important decisions without asking"** - telling AI "don't do this, research alternatives" is the bad fix; The Framework makes AI self-gauge its confidence before starting to work, and self-gauge the variability of its plan so that alternatives with subtle pros and cons are shown to the user.
- **"AI forgets"** - the user keeps repeating previous decisions and business context; instead AI retains knowledge in files such as `knowledge-base/DECISIONS.md` and `knowledge-base/INSIGHTS.md`.
