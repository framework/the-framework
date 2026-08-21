The options gear: an agent's options as one checkbox dropdown that writes each preference straight through, topped by the single-choice "Run on" picker for where it executes.

## Flows

- "Run on" is one flat list with exactly one checkmark: this machine, a fresh GitHub Actions runner, a hand-off to a Claude web cloud session, then the saved devices — each with a reachability dot and removable in place — and "Add a device".
- Picking a device makes it the run target on the spot — no navigation; the local daemon relays agents to it. Picking "This machine" while the dashboard is browsing a remote daemon navigates back home instead.
- A disabled option stays visible with the reason it does not apply, and cannot be flipped.
- The trigger wears a small dot whenever any option is on.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
