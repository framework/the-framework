The settings page: the daemon address, the bridge token, and the tab-opening switch live in extension storage — out of reach of any web page — and saving immediately proves the connection instead of just storing it.

## User Stories

- The user saves the daemon address and the bridge token, and immediately sees the connection proven or the exact failure named.
- The user switches automatic tab-opening on or off, and opens the tabs on demand instead of waiting on the timer.

## Flows

- The test names the exact failure: Chrome not actually granting site access (a site the extension declares is not automatically a site Chrome granted, and without the grant no request ever leaves the browser), daemon unreachable, token rejected, a version the daemon refuses (its answer, naming both versions and the way out, is shown verbatim), the bridge switched off in The Framework, or a dashboard too old to have a bridge — that last one answers with its own app page, a look-alike success not accepted as connected.
- Success also says how many cloud sessions the daemon is watching, so "connected but nothing happens" answers itself.
- A button runs the tab sweep — the pass that opens a pinned tab per watched cloud session — on demand and reports what it did, sparing the wait on the timer.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
