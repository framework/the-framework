What the tests cover: the changed files of the agent's own checkout are listed with their new/modified status and line counts; the running totals (file count, lines added and removed) are reported upward even while the list is collapsed, and the summary renders them as "2 files · +13"; an agent that changed nothing renders nothing at all and reports zero, so no disclosure is offered; a file's diff is only fetched when that file is expanded, never up front; a failed read leaves the panel silent instead of surfacing an error.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
