The project list and the launcher's pre-flight answers: which projects are registered, adding new ones, and whether an agent started now would get anywhere.

## TLDR

- Adding a project (one repo, or every repo under a folder) goes through the daemon so it lands in the shared registry; the onboarding hint offers the daemon's own directory as the first project — and a public host neither offers nor accepts, and must not disclose where it runs.
- The pre-flight reads warn before a doomed start rather than after: whether Claude Code trusts the folder (an untrusted one dies on a dialog nobody sees), whether the repo allows auto-merge (an armed merge otherwise lands before CI has run), and whether the chosen driver's CLI is installed and logged in — reporting only problems the user can act on, never account details a visitor on a network-bound host has no business seeing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
