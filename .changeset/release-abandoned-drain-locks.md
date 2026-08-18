---
'@gemstack/the-framework': patch
---

A ticket claim whose agent settled with nothing to hand off is now released by the daemon. The lock's normal release is the agent's own PR deleting it, but a drain that finishes without a single commit — say it closed the issue through `gh` instead of code — never opens that PR, so the ticket, plan, lock, and queue entry all survived a cleanly-finished agent and every later sweep dropped the entry as "already claimed": the queue livelocked on a dead claim until a human clicked Release (#1583). The release keys off the run's own recorded ending, never a timer (#1420's no-staleness rule stands), and frees only a lock still naming the exact agent the sweep minted it for — a lock naming anyone else is someone's live claim and is left alone.
