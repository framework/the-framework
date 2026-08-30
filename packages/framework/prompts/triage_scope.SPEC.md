The rule shared by both triage presets, appended to each so the pair cannot drift apart on it: a triage agent only queues work, it never does it. The only thing it changes is the agent queue (`TODO_AGENTS.md`), and only through the `tickets` skill's command — it must not implement a ticket however small that ticket's plan is, no code changes and no pull request for it. Every ticket it picks goes onto the agent queue, where a human can still veto it before an agent implements it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
