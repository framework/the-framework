Priority: 9
Topics: [bug]
GitHub: [#1225](https://github.com/framework/the-framework/issues/1225)

# Choices no working with CC web

## TLDR

**Everything this issue reported is addressed on `main`; it stays open only for follow-ups tracked elsewhere (headless extension: #1332).** The invented choices panel was fixed by #1234 long ago. The 2026-08-17 bridge/mirror failure turned out to be a stale v0.7.1 extension copy in Chrome, not a bug — re-tested 2026-08-21 end to end on a real Framework-started cloud run (`2026-08-21T15-35-24-093Z`): bridge contact `status 200`, transcript reaching the daemon, the run view's Cloud session mirror rendering the session. The two mirror complaints from that re-test were then fixed by #1671 (extension 0.10.0): claude.ai marks each turn as a `transcript-row`, so the mirror shows one entry per turn with roles mapped (user turns as a `you ›` line, markers skipped) instead of dumping `main`'s `innerText` — and the 8000-char cap is per turn, so nothing real is cut from the front any more. The open design question ("a TF-started cloud session never parks, so the bridge's answer-delivery half can never fire") was settled meanwhile by #1554/#1664: a session parks on its gates when the bridge is on, and the answer is typed back into the session's composer.

Maintainer's direction on the thread: ideally, from a user perspective, **CC web is a driver just like any other driver** — that was #1554's ask, closed 2026-08-23.

## Why it matters

Marked highest-prio 🌟: choices are the human-in-the-loop core, and for web runs they were being locally invented rather than mirroring the real session. With gate parking + answer type-back (#1554/#1664) and the per-turn mirror (#1671) landed, the user-visible bug this ticket tracked is done — closing it is the maintainer's call; remaining work rides other tickets.

## Source

Imported from GitHub issue [framework/the-framework#1225](https://github.com/framework/the-framework/issues/1225), created 2026-07-26, labels: `bug`, `highest-prio 🌟`, 5 comments (last folded: 2026-08-23T22:23Z).

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

- Originally reproduced 3/3 CC-web attempts, each time with the same choice — #1234 found the shown choices were locally invented by the relay rather than coming from the web session.
- The 2026-08-21 re-test also held the detached-session rule where it still applies (bridge absent): read-only task, no gate, no PR, and it said so.
- One gap confirmed and still open: the #1519 version gate can't report an extension that never got through — a stale extension with a stale token dies at `authorized()` before it ever states a version, which is what made 08-17 look like "extension accepted" when it meant "extension never arrived".
- The `.plan.md` (verify-and-close protocol) predates the #1554/#1664 parking design and the #1671 per-turn mirror — marked outdated; its close-out step (close #1225, delete the ticket files) is now the maintainer's call.
