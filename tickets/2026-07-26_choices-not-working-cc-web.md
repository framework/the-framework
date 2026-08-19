Priority: 9
Topics: [bug]
GitHub: [#1225](https://github.com/gemstack-land/the-framework/issues/1225)

# Choices no working with CC web

## TLDR

Original symptom — the dashboard showing a locally-invented choices panel for a CC-web run that never updates — is **gone** per the 2026-08-17 re-test: cloud sessions now answer their own gates under the detached-session rule instead of parking. What remains is the bridge/mirror half: the run view's "Cloud session mirror" hangs at "Connecting…" because a stale extension copy (v0.7.1 loaded vs 0.8.0 shipped since #1548) fails silently — the #1519 version gate (426) sits *behind* the bearer check in `bridge-endpoints.ts`, so a stale extension's requests die before any version claim is recorded and no blocked banner appears.

## Why it matters

Marked highest-prio 🌟: choices are the human-in-the-loop core, and for web runs they were being locally invented rather than mirroring the real session (#1234 found the cause; its fix stops cloud runs parking on made-up questions). The real interaction story for web runs is being built in #1237 (extension bridge) / #1265 / #1266 — this issue is the user-visible bug that work must close out.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1225](https://github.com/gemstack-land/the-framework/issues/1225), created 2026-07-26, labels: `bug`, `highest-prio 🌟`, 2 comments.

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
- Re-test 2026-08-17 (post #1518/#1536/#1544/#1548), run `2026-08-17T12-31-39-194Z`: original symptom gone — a run whose prompt demanded a choice gate refused to park, picked the recommended option per the detached-session rule, finished clean. Remaining work:
  - Mirror re-test with the correct extension: reload `packages/chrome-extension` v0.8.0 at chrome://extensions, remove the stale v0.7.1 copy (which reported `bridge: Failed to fetch` and false-positive-detected the system prompt's own rendered template as a question — the decoy problem current `content.SPEC.md` fixes).
  - Consider making the #1519 version gate also flag never-heard-from/unauthorized contacts, since the gate behind the bearer check means a stale extension fails silently.
  - Design question (maintainer's call): with the detached-session rule, a TF-started cloud session never parks on a choice, so the bridge's answer-delivery half can never fire — either that's the intended end state (issue closes once the mirror works) or parking should be allowed when the bridge is connected and healthy. Overlaps with #1554's ask to pipe choices through the CC web driver.
