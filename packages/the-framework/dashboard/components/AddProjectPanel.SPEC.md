The "Add project" modal: registers a repo — or every git repo directly under a folder — with the daemon so it joins the project list.

## User Stories

- The user adds a repo (or a folder of repos) as a project from the dashboard, and confirms they trust it before anything is installed.

## Flows

- The user types a path and submits — and nothing is installed yet: a trust confirmation appears first. Adding a repo lets the agent read its files, and hidden instructions in an untrusted repo can hijack the agent (prompt injection), so the install waits until the user confirms trust.
- After a folder add, the user sees how many repos were registered (and how many already were) instead of the modal finishing silently.
- It behaves like the dialog it claims to be: Esc closes, Tab stays inside, and focus returns to the control that opened it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
