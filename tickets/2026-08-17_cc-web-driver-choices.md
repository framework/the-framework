Priority: 8
Topics: [cc-web]
GitHub: [#1554](https://github.com/gemstack-land/the-framework/issues/1554)

# [CC web driver] Add support for choices? For full-fledged CC web driver

## TLDR

Can the choice macros (`await-choices` gates) be piped through to TF for "Run on: Claude web" runs, so a web session's questions surface in the dashboard like local runs do?

## Why it matters

Labeled priority-high as a decision forcer: the answer determines whether to keep investing in the CC web driver at all. Together with the headless-extension spike (#1332, cross-linked from the issue) this is what "full-fledged CC web support" means.

Note the tension with the current design: under the detached-session rule a TF-started cloud session never parks on a choice (see the 2026-08-17 re-test notes on #1225 / `2026-07-26_choices-not-working-cc-web.md`), so supporting choices here implies allowing parking when a healthy delivery channel exists.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1554](https://github.com/gemstack-land/the-framework/issues/1554), created 2026-08-17, labels: `priority: high`, 0 comments.

### Original description

Can we pipe the choice macros to TF?

Labeling as high prio so that we know whether we should invest in the CC web driver.

For full-fledged CC web support, see also:
- https://github.com/gemstack-land/the-framework/issues/1332
