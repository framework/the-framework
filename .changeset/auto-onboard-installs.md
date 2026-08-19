---
'@gemstack/the-framework': patch
---

Auto-onboarded repos are installed before they are registered (#1600): the repos-directory scan now runs the same install as the dashboard's "Add project", so every onboarded repo gets the self-ignoring `.the-framework/.gitignore` before any agent can `git add -A` framework state onto a work branch. Activation now means that ignore file exists (not merely the `.the-framework/` directory), and the repo-root `branches` shortcut is hidden through the repo-level git exclude the moment it is created.
