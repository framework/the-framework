The one way every dashboard panel reads from the daemon: ask, hold the answer, and ignore it if the panel has moved on since. A panel either reads once — and again whenever what it is reading about changes — or reads repeatedly on its own cadence.

## Business logic — TL;DR

- **A failed read keeps the last answer** - a daemon restart or a dropped request leaves the panel showing what it last knew instead of blanking; the next attempt usually succeeds, and a failure never surfaces as a crash.
- **A late answer is discarded** - once the panel has switched to a different project or agent, or gone away entirely, an answer still in flight for the old one is dropped rather than written over the current view. An immediate re-read obeys the same rule.
- **Nothing to read means nothing is asked** - with no project selected there is no request at all, and the panel simply shows its empty starting state.
- **Switching clears first** - changing what is being read empties the panel rather than briefly presenting the previous target's data as this one's. A panel may opt out where blanking is worse than staleness: the agent toolbar's header keeps the resolved branch, PR and GitHub link on screen while the next one loads, so navigating between agents updates it in place instead of blanking and popping.
- **"Not read yet" is not "not there"** - whether a real answer has arrived is tracked separately and only a successful read sets it, so a panel can tell an agent that is genuinely gone from one whose first read is still out, and a daemon hiccup is never mistaken for an answer. It resets whenever the target changes.
- **An action does not wait for the next tick** - a panel can force an immediate re-read after a local action, instead of leaving the user looking at a stale screen until the cadence comes round.
- **Repeating stops when the panel does** - a panel that goes away stops asking.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
