Answers the live view's questions purely from an agent's event stream — the dashboard is a projection of the same journal the agent writes.

## TLDR

- The choice gates the agent is parked on: an answer closes one, the agent's end closes them all, so a dead agent's question stops looking answerable.
- The markdown views the agent has shown, one entry each, updated in place when re-shown.
- Whether the agent is still going, how it ended (clean, crashed, or stopped by you), and whether the agent has settled and now waits on you although its process stays alive as a conversation.
- Whether a cleanly-ended agent is still publishing — its armed handoff has not reported back yet — read off the stream, or off its stored summary for list rows.
- Links to a run's external home (its GitHub Actions run, its cloud session), found even by a tab opened mid-run.

## Rationales

- A resumed session appends a new segment to the same journal, and a long-lived feed can span run boundaries — so liveness, outcome, and publishing are judged on the newest segment only; otherwise a resumed run reads as stopped for ever and a fresh run shows its predecessor's log.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
