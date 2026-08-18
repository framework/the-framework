Build-time helpers that keep the prompting authored as markdown, and make the published package and the test suite self-contained.

## TLDR

- Every prompt markdown file is compiled into a generated module of plain strings before each build, test, and typecheck; the markdown is the only source of truth, and strings — unlike a file read at run time — also work in the browser, where the dashboard shows the user a prompt before an agent starts.
- Tests run against a throwaway home for the machine's global state, so the developer's live daemon can never leak into the suite and hang it. There are two suites and two runners: `node --test` over the compiled `src/`, and the dashboard's own browser-shaped tests.
- Copying the dashboard bundle is no longer a step: the dashboard is part of this package now, and its build writes straight into the `dist/` the daemon serves from.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
