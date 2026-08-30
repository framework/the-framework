The Projects surface: the list of registered projects with whatever the daemon last found wrong with each, adding new projects, the onboarding checklist's starting suggestion, and the two pre-flight facts the launcher checks before an agent is started.

## Business logic — TL;DR

- **The project list carries its own problems** - every project is listed with its id, path, name, whether it is activated and its last activity, plus the errors the daemon's background jobs recorded for it.
- **Projects are added through the daemon** - the repo is installed and registered in one action.
- **The folder is picked in the OS's own dialog** - the daemon opens the system folder picker on its machine and hands the choice back, because a browser page cannot learn an absolute path on its own.
- **Onboarding offers the directory the daemon runs in** - so the first project can be added without picking at all.
- **The launcher warns before the start, not after** - whether the chosen driver can actually start, and whether the repo allows GitHub's own auto-merge, are answered before an agent is spawned.

## Business logic

### The project list carries its own problems

#### User story

A project's branches cannot reach its remote. The user should see that on the project in the sidebar and on the project itself, without hunting for it.

#### Business logic

Each project in the list is annotated with the errors the daemon's background jobs last recorded for it; a project with no errors carries none. The problems ride the project list rather than a separate lookup, because the list is what every project surface already polls, so an error reaches the sidebar and the project's banner with nothing new to subscribe to.

### Projects are added through the daemon

#### User story

The user points the dashboard at a repo and gets it installed and listed.

#### Business logic

Adding is handed to the daemon, which installs the repo and writes it into the registry; the dashboard cannot do either itself. An empty path is refused.

### The folder is picked in the OS's own dialog

#### User story

The user should pick the repo's folder the way they pick any folder on their machine — in the system dialog — not by typing an absolute path into a form.

#### Business logic

The dashboard asks the daemon to open the OS folder picker; the daemon runs on the machine the user is sitting at, so the dialog appears there, and the picked absolute path is handed back. Dismissing the dialog is a normal answer of its own, distinct from a failure. A dialog that cannot open — no desktop session on the daemon's machine, no dialog helper installed on Linux, or a platform with no dialog wired up — comes back as that reason instead of being attempted.

#### Rationale

A browser page cannot learn the absolute path of anything picked in a dialog of its own — that is deliberate browser sandboxing — and the daemon needs the absolute path to install the repo. So the dialog has to be the daemon's.

### Onboarding offers the directory the daemon runs in

#### User story

A first-time user should be able to add their first project by clicking, not by typing a path.

#### Business logic

The onboarding checklist is told the directory the daemon was started in, and whether a project is already registered for it — so the step either offers to add it or shows it as done.

### The launcher warns before the start, not after

#### User story

The user is about to start an agent. If the driver's CLI is missing or logged out, or if the repo cannot auto-merge the way the armed handoff level implies, the user should hear it now — not hours later, from an agent that never started or a pull request that silently stopped short of merging.

#### Business logic

Driver readiness answers whether the chosen driver's CLI can start work at all — installed, logged in, and not running as root — and reports only problems the user can act on, plus warnings. When the handoff level being armed publishes as far as a pull request or a merge, the GitHub CLI is checked too. Details of the checks that passed — the version, the logged-in account — are never reported to the browser, which may belong to a relay guest.

Repo auto-merge answers whether the project's repo allows GitHub's own auto-merge, so a launcher arming the merge rung can note that merging will instead be done by the daemon's CI watch — which is sound, but only while the daemon is running. An unknown project answers with nothing. When the GitHub CLI cannot say — not installed, or not a GitHub repo — the answer is explicitly "not known", which renders nothing rather than warning about a problem that may not exist. The answer is cached, and never changes anything.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
