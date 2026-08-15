Build-time helpers that keep the prompting authored as markdown, and make the published package and the test suite self-contained.

## TLDR

- Every prompt markdown file is compiled into a generated module of plain strings before each build, test, and typecheck; the markdown is the only source of truth, and strings — unlike a file read at run time — also work in the browser, where the dashboard shows the user a prompt before a run.
- The dashboard app is developed in a separate unpublished package, so its prerendered bundle is copied into this package before publishing; an install without the bundle falls back to the basic built-in page.
- Tests run against a throwaway home for the machine's global state, so the developer's live daemon can never leak into the suite and hang it.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
