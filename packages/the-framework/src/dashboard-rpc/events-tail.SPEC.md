Follows an agent's on-disk event journal: replay what is already logged, then deliver each appended event — even across the journal's moves.

## TLDR

- Each logged event is handed over once, with a one-time signal after the backlog — the boundary a reconnecting viewer needs to swap its feed atomically instead of blanking while history re-streams.
- A journal does not sit still: teardown copies it into the archive and removes the checkout. "The file existed and is now gone" is treated as that move — the tail asks where the journal lives now and picks up there at the same position, so the ending's final lines arrive exactly once instead of being swallowed.
- While the new home is not yet visible (or never will be — a deleted agent), the tail idles rather than hopping somewhere wrong.
- A file watcher with a slow poll behind it, so a missed filesystem signal delays events rather than losing them.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
