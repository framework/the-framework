The `.the-framework/.gitignore` written at install — one file, one fixed content, and the file whose presence marks a project as activated. It ignores everything under `.the-framework/` except itself and the layout marker: agent state there (the event log, the agent meta, the worktrees) is transient on the default branch, and the lasting records live on the `agents-logs` branch — so the default branch stays 100% code plus the one tracked gate file.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
