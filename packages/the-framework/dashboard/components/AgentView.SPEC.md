One agent's view, live or finished, in a stable frame — bar, details, changes/handoff, transcript and composer — whose contents change instead of remounting when the agent ends.

## Flows

- The transcript is one log with two sources — the live channel while running, the archive once ended — swapped behind the events on screen, so an ending never blanks what the user is reading.
- Three guards keep that swap honest: an empty archive never replaces events already shown, a stale archive never hides a resumed agent's newest events, and a channel carrying some other run's log — the server's fallback once this agent's checkout is gone — never beats the agent's own archive. The archive is re-read once the live feed outgrows it, which is how the PR line written after the agent ends arrives without a refresh.
- "Done" means the agent settled — finished its work — not that its process died: a parked agent stays alive for the user's next message, so the handoff keys off settling.
- While the agent works, the bar summarizes its checkout's changes; once it settles, the summary swaps — only after the branch read has loaded, never blanking — to what the branch holds.
- An agent executing elsewhere says so in place: a GitHub Actions run's log arrives as one burst at the end (the wait is named, with a link to the live run), a web run points at its Claude cloud session, and a run on a connected device flags that only its browser preview stays on the device.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
