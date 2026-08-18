Covers the parked-wait keepalive: the first hold starts the timer and settling stops it, overlapping holds share one timer released by the last to settle, a rejected wait still releases, a later wait starts fresh, and the real timer genuinely holds the process open rather than being decoration.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
