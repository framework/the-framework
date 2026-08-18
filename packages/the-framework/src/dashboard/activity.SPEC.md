The activity feed: the cross-project stream of agent lifecycle moments — an agent started, an agent finished — that notify without needing the human.

## TLDR

- Each project's recent agents contribute one item apiece: "started" while it runs, "finished" once it ends, tagged by how it ended so a stop reads differently from a success.
- A start and a finish are separate events, so an agent notifies at most twice — and one that starts and ends between two looks notifies once, as finished.
- The default-off "for your information" counterpart to the always-on "needs you" interventions queue.
- Several updates post to Discord as one message; a project whose history cannot be read contributes nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
