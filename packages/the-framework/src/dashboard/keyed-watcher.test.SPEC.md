The tests cover the announce-only-what-is-new behavior: the first poll seeds a silent baseline, identity is the caller's (an agent starting and finishing are two separate announcements), and a failed scan or projection announces nothing. They also cover the baseline being per project: a poll that reached no project earns no baseline (so a start-up without GitHub cannot flood), a project that only becomes readable later is baselined then rather than announced, and one permanently unreadable project does not stop the others notifying.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
