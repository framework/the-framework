The accounting every run shares, whatever kind it is: naming the session, following the agent's progress, and totalling what it spends.

## TLDR

- Lives once because a build run and a direct prompt do different work but identical accounting — keeping two copies is how one path once silently lost a feature the other had.
- The agent's real session id is surfaced the moment a turn starts, not only when it ends, so the handle for resuming the conversation survives a stop or crash mid-turn.
- Nothing here stops a session for spending. It used to hold two such stops — a per-run cost cap and a mid-run quota gate — each firing after the turn that crossed it, when the money was already gone. Spending is decided once, before a session starts: interrupting mid-flight saves the cheap part and loses the expensive part.
- An unreadable quota never stops the work: a failing quota check means carry on.
- One shared classification of how a run ended — user stop, budget cap, declined plan, quota pause (which leaves a note to resume from), or a real failure — so every surface agrees on what "stopped" means.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
