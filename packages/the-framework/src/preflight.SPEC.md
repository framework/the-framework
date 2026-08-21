Pre-start checks so an agent is refused early and clearly when a prerequisite is missing, instead of spawning a broken one.

## User Stories

- The user is refused at Start, with the fix named, when the picked CLI is missing or logged out — before a branch or checkout is spent on an agent that cannot run.
- The user who armed publishing is warned — not blocked — when the GitHub CLI is missing or logged out.

## Flows

- The checks run on the framework's side before anything is spawned — the spawned agent never re-checks.
- The driver CLI the agent actually picked is verified installed and logged in — installed is not usable: a logged-out CLI kills every agent before it starts, while the machine keeps spending branches and checkouts on each attempt.
- Only a clear "not logged in" blocks; a CLI that will not say gets the benefit of the doubt, because an agent that might work beats a refusal we cannot stand behind.
- When the agent will publish (PR/merge), the GitHub CLI is checked too — as warnings only, since its own work needs no GitHub and only publishing would degrade.
- Running as root warns without blocking (a container legitimately is root): under sudo the driver looks for credentials in the wrong home and every agent dies with a log that says nothing about why.
- Every failure and warning names its fix.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
