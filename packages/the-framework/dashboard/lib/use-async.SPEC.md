The one guarded way every panel reads from the daemon — once, or again on a steady interval — instead of each panel hand-rolling the same fetch loop.

## TLDR

- A failed read keeps the last answer on screen rather than blanking it: an empty panel would read as "nothing there" when the truth is "no answer", and the next tick usually recovers.
- An answer that lands after the panel moved on (switched target, closed) is dropped, so a slow read can never show the wrong target's data.
- Callers can tell "not there" from "not read yet", so absence is never claimed before the first answer arrives.
- Switching targets normally clears the panel while the new answer loads; a surface can instead keep the old answer and update in place, trading a blank flicker for a brief staleness.
- With nothing to read yet (no project selected), nothing is read; an on-demand refresh exists for actions whose effect should show before the next tick.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
