The layout gate: a framework build refuses to run in a repo that records a different bookkeeping layout, instead of committing files under names the repo no longer uses.

## Flows

- Every activated repo carries a small committed marker naming the layout its bookkeeping is on (the data branch's name, and where archives, tickets, and the queue live).
- Before a session starts, the build compares the repo's marker against its own layout; a mismatch refuses the session outright with both sides named and the fix — no degraded mode.
- A repo without the marker is not gated; installing writes it, so every newly activated repo is gated from the start.
- The marker's content is derived from the build itself, so renaming anything in the layout changes the marker by itself; a test pins the repo's checked-in marker to the derivation, so a rename cannot land without regenerating the marker in the same change.
- The refusal message names the file, both layouts, and how to fix each direction (update the installed framework, or regenerate the marker when the build is the newer side).

## Rationales

- The failure the gate closes: the cloud environment installs the framework from npm, so a published build can predate a repo-side rename; run unguarded, it commits its session archive under the old name and is rejected hours later by the main branch's guard — with a message about symptoms — when the session could have refused seconds in with the cause named.
- Refuse rather than warn, same stance as the extension version gate: a skewed build does not fail loudly on its own — it half-works, and its wrong-layout commits look plausible to a human.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
