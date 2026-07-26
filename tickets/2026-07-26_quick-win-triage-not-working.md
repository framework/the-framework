Status: open
Priority: 9
Topics: [bug]
GitHub: [#1251](https://github.com/gemstack-land/the-framework/issues/1251)

# Bug: quick-win triage not working

## TLDR

Clicking `Run now` on the quick-win triage routine misbehaves: the UI claims it "opens" an old PR (#1177) while what it actually opened is #1249. Urgent — blocks the demo video. Reproduction: click `Run now`.

## Why it matters

Marked urgent by the maintainer: the quick-win triage routine is part of the demo video, and a routine whose result links to the wrong PR makes the autonomy story look broken. Labeled `highest-prio 🌟`.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1251](https://github.com/gemstack-land/the-framework/issues/1251), created 2026-07-26, labels: `bug`, `highest-prio 🌟`.

### Original description

Quite weird: it "opens" an old PR:

<img width="934" height="639" alt="Image" src="https://github.com/user-attachments/assets/a8da2b81-1605-4fd1-9718-1ceb6c81eb74" />

<hr>

- https://github.com/gemstack-land/the-framework/pull/1177

What it did seem to open instead is this:
- https://github.com/gemstack-land/the-framework/pull/1249

Urgent, blocks the demo video.

Reproduction: click `Run now`.

<img width="1051" height="52" alt="Image" src="https://github.com/user-attachments/assets/8fd09933-95d6-42c5-83be-276513b516fc" />
