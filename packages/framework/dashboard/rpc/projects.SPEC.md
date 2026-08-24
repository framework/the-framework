The dashboard's handles for the projects the user works on: listing them, registering new ones, and the pre-flight checks the launcher shows before starting an agent.

Each handle is declared against the daemon's own implementation, so a rename or a changed shape breaks the dashboard at build time instead of failing as a missing route once a user opens the Projects page.

## Business logic — TL;DR

- **The project list** - read every registered project with the state the dashboard renders it from.
- **Adding a project** - ask the daemon to open the OS folder picker and hand back the user's choice, then register the chosen repo. Two handles, because the trust confirmation sits between them.
- **Onboarding suggestion** - the directory the daemon was started in, so the first onboarding step can offer to add it without the user typing a path.
- **Auto-merge readiness** - whether the project's repo allows GitHub's own auto-merge, so the launcher can warn that arming the merge rung leaves merging to the daemon's CI watch, which only works while the daemon runs.
- **Driver readiness** - whether the picked driver's CLI can start at all (installed, logged in, not running as root), and, when the agent is meant to publish, whether the GitHub CLI is usable too — reported before the Start rather than discovered as a stalled agent afterwards. Only problems the user can act on come back; version strings and account names stay on the daemon.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
