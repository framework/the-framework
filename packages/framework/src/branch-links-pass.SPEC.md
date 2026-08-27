The daemon's turn of the branch-links reconcile: every registered project's `.the-framework/branches/` links are brought in line with its checkouts, one pass per call on the daemon's clock, and again right after each checkout allocation so a fresh checkout gets its link immediately. Overlapping calls join the pass in flight, a stopped pass does nothing, and nothing is logged: links are presentation, and narrating every rename would drown the log. The reconcile itself is the branch-management package's.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
