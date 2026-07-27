Status: open
Priority: 9
Topics: [bug]
GitHub: [#1225](https://github.com/gemstack-land/the-framework/issues/1225)

# Choices no working with CC web

## TLDR

Running a prompt via CC web: the dashboard shows a choices panel before the agent has even replied on CC web, and it never updates afterwards (also not after a page refresh) — the actual reply exists only on claude.ai. Reproduced 3 out of 3 attempts, surprisingly with the same choice each time.

## Why it matters

Marked highest-prio 🌟: choices are the human-in-the-loop core, and for web runs they were being locally invented rather than mirroring the real session (#1234 found the cause; its fix stops cloud runs parking on made-up questions). The real interaction story for web runs is being built in #1237 (extension bridge) / #1265 / #1266 — this issue is the user-visible bug that work must close out.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1225](https://github.com/gemstack-land/the-framework/issues/1225), created 2026-07-26, labels: `bug`, `highest-prio 🌟`, 1 comment.

### Original description

My prompt I fired using the dashboard (run via CC web):

```
https://github.com/gemstack-land/the-framework/issues/1144
```

I get this in the dashboard before even the agent replies on CC web:

<img width="1366" height="729" alt="Image" src="https://github.com/user-attachments/assets/3793a1c7-3506-4365-a058-0e97e43327ce" />


Later, I get this reply on CC web: 

<img width="1366" height="725" alt="Image" src="https://github.com/user-attachments/assets/3279b4c8-0886-4c66-95f5-61a19ed40d1b" />

But I still get the same view shown above in the dashboard, also after refreshing the page.

### Notes from the GitHub thread

- Reproduced 3/3 CC-web attempts, each time with the same choice — consistent with #1234's finding that the shown choices were locally invented by the relay rather than coming from the web session.
