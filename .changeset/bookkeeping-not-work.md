---
'@gemstack/the-framework': patch
---

A run that produced nothing beyond the framework's own bookkeeping no longer pushes a branch or opens a PR. Every run's branch carries the framework's paper trail (the conversation record swept in by the pre-work commit), and that one commit used to defeat the handoff's emptiness check, so a run that did no work still published a PR of pure bookkeeping. The changed files now decide: a branch whose every change is under `.the-framework/` is empty, so the auto-handoff skips it, the Open PR button refuses it, and the panel says the session produced nothing. The bookkeeping itself stays committed; it just no longer counts as work.
