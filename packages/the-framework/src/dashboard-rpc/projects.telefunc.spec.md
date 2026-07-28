The Projects-sidebar telefunctions (#405): list registered projects, add new ones, the onboarding suggestion, and the Claude Code trust check.

## TLDR

- `onProjects`: the global registry (#390) via `contextProjects()` — the per-run foreground scopes it to a single project (#427).
- `sendAddProject` (#396/#433): install one repo or every git repo under a directory, via the daemon's `addProject` closure on the request context (it spawns git and writes the shared registry); typed error where unwired.
- `onOnboarding` (#958): the daemon's `process.cwd()` plus whether it is already registered, so the checklist can offer "Add {cwd} as project"; gated on `addProject` so a public host neither acts on nor discloses where it runs.
- `onClaudeTrust` (#1318): whether Claude Code trusts the project root, so the launcher warns *before* a web run dies on the CLI's interactive trust dialog (#1314); read-only — trusting stays the user's act in the CLI; worktrees inherit the root's answer.
