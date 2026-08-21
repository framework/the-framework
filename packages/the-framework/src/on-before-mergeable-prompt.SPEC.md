The prompt sent to an agent once its work is ready to merge: queue the quality reviews as follow-up work, and fold what it learned back into the project's business-knowledge docs.

## User Stories

- The user finds quality follow-ups queued after an agent's work is ready to merge, instead of review agents running on the spot.
- The user's business-knowledge docs grow what the finished agent decided and learned.

## Flows

- The agent judges its own finished changes and queues the matching quality presets onto the project's queue file (`TODO_AGENTS.md`) rather than running them on the spot: refactor potential queues the maintainability review, possible security impact queues the security audit. The backlog loop picks the entries up later.
- Every queued entry targets the changes introduced by the finished agent, named explicitly.
- The prompt also asks the agent to fold what the session decided and learned into the project's business-knowledge docs (`knowledge-base/DECISIONS.md`, `FACTS.md`, `INSIGHTS.md`), creating them when missing — and to write only what a future agent needs and cannot get from the code itself.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
