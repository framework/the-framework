Every agent's open question gathered into one hub, so a human can answer any parked agent from one place instead of hunting through their individual views.

## User Stories

- The user answers any waiting agent's question from one hub, across every project.
- The user sees each question whole — its options, the recommended pick, whether several may be chosen — not just a title.
- The user sees the agent that has waited on them longest first.

## Flows

- The full question — options, recommendation, whether several may be picked — is read back from each parked agent's own log, because the agent's status record carries only the question's title.
- Longest-waiting first: the agent blocked on its human the longest is the one to unblock first.
- A question the log no longer shows open (already answered, or unreadable) is dropped — offering an answer the daemon would refuse is worse than one card fewer.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
