The project list and the launcher's pre-flight answers: which projects are registered, adding new ones, and whether an agent started now would get anywhere.

## User Stories

- The user sees every registered project, and a project in trouble wears its error right in the sidebar and on its page.
- The user adds a project from the dashboard — one repo, or every repo under a folder.
- The user is warned before a doomed start: a merge armed on a repo that cannot auto-merge, a driver CLI that is missing or logged out.

## Flows

- Each listed project carries what the daemon's background jobs currently find wrong with it — a data branch that cannot reach origin — and the one list every project surface already polls is how that error reaches the sidebar's red dot and the project page's banner.
- When the user adds a project (one repo, or every repo under a folder), the daemon installs and registers it, so it lands in the shared registry; the onboarding hint offers the daemon's own directory as the first project.
- The launcher — the form that starts an agent — warns before a doomed start rather than after: whether the repo allows auto-merge (an armed merge otherwise lands before CI has run), and whether the chosen driver's CLI is installed and logged in. Only problems the user can act on are reported — never account details a visitor on a network-bound host has no business seeing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
