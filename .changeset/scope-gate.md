---
'@gemstack/the-framework': patch
---

A run whose build declares small scope skips the production-grade checklist (#1356). The signal protocol gains a `set-scope` block (`small` / `large` / `very-large`); a `small` verdict resolves the checklist pass clean without dispatching an agent, with a log saying why. Only an explicit `small` skips — no verdict (an older prompt, a run without the protocols) keeps the full checklist, so the gate can only ever drop work the agent said was unnecessary.
