Pre-start checks so a session is refused early and clearly when a prerequisite is missing, instead of spawning a broken agent. Run once, by the dashboard, before it spawns anything — the session itself does not check again.

## TLDR

- Verifies the agent CLI the run actually picked is installed and logged in — installed is not usable: a logged-out CLI kills every session before it starts, while the machine keeps spending branches and checkouts on each attempt.
- Only a clear "not logged in" blocks; a CLI that will not say gets the benefit of the doubt, because a run that might work beats a refusal we cannot stand behind.
- When the run will publish (PR/merge), the GitHub CLI is checked too — as warnings only, since the session's own work needs no GitHub and only publishing would degrade.
- Running as root warns without blocking (a container legitimately is root): under sudo the agent looks for credentials in the wrong home and every run dies with a log that says nothing about why.
- Every failure and warning names its fix.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
