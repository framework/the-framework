Build-time helpers that keep the prompting authored as markdown, and make the published package and the test suite self-contained.

## Flows

- Every prompt markdown file is compiled into a generated module of plain strings before each build, test, and typecheck; the markdown is the only source of truth.
- Tests run against a throwaway home for the machine's global state, so the developer's live daemon can never leak into the suite and hang it. There are two suites and two runners: Node's test runner over the compiled daemon suite, and the dashboard's own browser-shaped tests.

## Rationales

- Prompts are compiled to plain strings rather than read from disk at run time because strings also work in the browser, where the dashboard shows the user a prompt before an agent starts.
- The dashboard is part of this package and its build writes straight into the `dist/` the daemon serves from, so no helper has to copy a bundle around.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
