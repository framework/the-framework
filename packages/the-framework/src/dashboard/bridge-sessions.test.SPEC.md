What the tests cover: which cloud sessions the Claude web bridge offers the Chrome extension to open a tab for.

- Only `web`-target agents that actually recorded a cloud session are offered; `local` and `actions` agents are never offered, nor is a `web`-target agent whose hand-off never landed.
- An agent's status is deliberately not part of the filter: a hands-off `web`-target agent always reads as finished, so filtering on status would offer nothing at all.
- Cloud sessions whose agent started outside the recency window are dropped, and an unparseable start time is dropped rather than treated as just now.
- The list is newest first and never longer than the tab cap.
- The same cloud session reached by two agents is offered once.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
