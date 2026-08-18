Pre-start checks so an agent is refused early and clearly when a prerequisite is missing, instead of spawning a broken one. Run once, by the dashboard, before it spawns anything — the agent itself does not check again.

## TLDR

- Verifies the driver CLI the agent actually picked is installed and logged in — installed is not usable: a logged-out CLI kills every agent before it starts, while the machine keeps spending branches and checkouts on each attempt.
- Only a clear "not logged in" blocks; a CLI that will not say gets the benefit of the doubt, because an agent that might work beats a refusal we cannot stand behind.
- When the agent will publish (PR/merge), the GitHub CLI is checked too — as warnings only, since its own work needs no GitHub and only publishing would degrade.
- Running as root warns without blocking (a container legitimately is root): under sudo the driver looks for credentials in the wrong home and every agent dies with a log that says nothing about why.
- Every failure and warning names its fix.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
