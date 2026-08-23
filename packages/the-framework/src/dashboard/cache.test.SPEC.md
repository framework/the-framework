What the tests cover: how the dashboard's cache for slow reads behaves.

- Several simultaneous asks for the same answer share a single fetch, so two panels and a poll tick never become three fetches.
- A known answer is served without fetching again until it has aged past its lifetime; once it has, the caller still gets the old answer at once and the refresh happens behind it, so the next ask gets the newer answer.
- A first ask that outlasts its budget reports "still loading" rather than "there is no answer" — the two are distinguishable — and the answer is there for the following ask.
- A failed fetch keeps the last good answer instead of dropping it, so a panel does not lose what it knew to one bad call.
- Dropping a cached answer on demand makes the next ask fetch again.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
