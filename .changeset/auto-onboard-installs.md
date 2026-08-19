---
'@gemstack/the-framework': patch
---

The repos-directory auto-scan is removed (#1600): the daemon no longer installs and registers every repo under a configured directory at boot (the `reposDirectory`/`reposDirectoryAutoGrant` preferences are gone with it) — the dashboard's "Add project" is the one onboarding path, so a repo is always installed before any agent touches it. Two fixes ride along: activation now means the install-written `.the-framework/.gitignore` exists (not merely the `.the-framework/` directory), and the repo-root `branches` shortcut is hidden through the repo-level git exclude the moment it is created.
