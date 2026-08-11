Lets a chat user type an @agent-name mention to force the orchestrator to dispatch that agent, overriding its own routing judgment.

## TLDR

- Mentions of known agents are extracted (deduplicated, first-seen order) and stripped so the model sees the cleaned request; unknown mentions and email addresses stay untouched as plain text.
- The extracted mentions render into a hard system-prompt rule instructing the orchestrator to dispatch each mentioned agent in order, no questions asked — the server has already validated the mentions.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
