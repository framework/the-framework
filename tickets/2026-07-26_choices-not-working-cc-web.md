Status: open
Priority: 9
Topics: [bug]
GitHub: [#1225](https://github.com/gemstack-land/the-framework/issues/1225)

# Choices no working with CC web

## TLDR

Firing a prompt via the dashboard with `Run on: Claude web`: the dashboard shows a choices card *before* the agent even replies on CC web, and when the agent's real reply lands on CC web the dashboard still shows that same stale view — also after a page refresh. Reproduced 3 out of 3 tries, surprisingly with the same choice each time.

## Why it matters

The CC web target currently lies to the user: it displays locally-invented choices about work that has left the machine (see #1234/#1231 for the diagnosis of where those choices come from) and never reflects what the cloud session actually said. Labeled `highest-prio 🌟`. Related: #1234 (the deadlock half), #1237 (the bridge that would show the real question).

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

- "Tried CC web 3 times, got this exact problem 3 times (with surprisingly the same choice)."
