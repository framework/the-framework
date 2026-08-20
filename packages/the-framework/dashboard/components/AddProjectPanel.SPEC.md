The "Add project" modal: registers a repo — or every git repo directly under a folder — with the daemon so it joins the project list.

## Flows

- Adding is a two-step act: submitting the path first shows a trust confirmation, because adding a repo lets the agent read its files and hidden instructions in an untrusted repo can hijack the agent (prompt injection); nothing is installed until trust is confirmed.
- A folder add reports how many repos it registered (and how many already were) instead of finishing silently.
- It behaves like the dialog it claims to be: Esc closes, Tab stays inside, and focus returns to the control that opened it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
