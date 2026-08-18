The settings page: the daemon address, the bridge token, and the tab-opening switch live in extension storage — never in the page — and saving immediately proves the connection instead of just storing it.

## TLDR

- The test names the exact failure: Chrome not actually granting site access (declared is not granted, and without it the daemon sees nothing), daemon unreachable, token rejected, a version the daemon refuses (its answer, naming both versions and the way out, is shown verbatim), bridge switched off, or a dashboard too old to have a bridge — whose look-alike success page is not accepted as connected.
- Success also says how many cloud sessions the daemon is watching, so "connected but nothing happens" answers itself.
- A button runs the tab sweep on demand and reports what it did, sparing the wait on the timer.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
