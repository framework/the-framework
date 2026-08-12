The activity feed: the cross-project stream of run lifecycle moments — a session started, a session finished — that notify without needing the human.

## TLDR

- Each project's recent runs contribute one item apiece: "started" while it runs, "finished" once it ends, tagged by how it ended so a stop reads differently from a success.
- A start and a finish are separate events, so a run notifies at most twice — and a run that starts and ends between two looks notifies once, as finished.
- The default-off "for your information" counterpart to the always-on "needs you" interventions queue.
- Several updates post to Discord as one message; a project whose history cannot be read contributes nothing.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
