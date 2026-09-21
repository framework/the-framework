The project's forge [1], reached by declaration: whichever of the project's installed packages declares in its own `package.json` that its command provides the `forge` kind of data (`"framework": { "forge": "<command>" }`) answers the pull requests, and this tool runs that command in the project the way the dashboard runs any provided command (the shared library's rule, `agent-data`). The tool names no forge and no package; a project with no such package has no pull requests to read back and nothing to merge.

## Context

**Business logic story**: a run ends and must record which pull request its branch has (`run.ts`); a follow-up ends done and the first run's pull request must be merged (`run.ts`). Both go to the project's forge command; the tool never runs a forge's own client itself.

## Glossary

[1] forge: the service hosting the project's repository and its pull requests, GitHub for instance, as the project's forge package answers for it.

## Business logic — TL;DR

- **Which package** - the one the project declares for the `forge` kind, resolved by the shared library (one declarer; or the one the project's `package.json` names when several declare it; none otherwise).
- **A branch's pull request** - `requests --branch <branch>` asked of that command; the first row's number and URL; none when there is no forge package, the command refuses, or it answers no rows.
- **Merging a pull request** - `merge <number>` asked of that command; its outcome (`auto-armed`, `merged` or `watching`) as it answers it; `failed` with the reason when there is no forge package ("this project has no forge package"), the command refuses, or it answers no outcome.
