---
'@gemstack/the-framework': patch
---

Auto PM now sweeps as soon as "Spend what's left on the roadmap" is switched on, instead of up to ten minutes later, and the usage panel says what the last sweep decided. Every decision was already logged, but the log is the daemon's stdout and the toggle is in a browser, so a sweep standing down for a reason looked exactly like one quietly working.
