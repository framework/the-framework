The accounting every run shares, whatever kind it is: naming the session, following the agent's progress, totalling what it spends, and stopping it cleanly when a cap or the account's quota is reached.

## TLDR

- Lives once because a build run and a direct prompt do different work but identical accounting — keeping two copies is how one path once silently lost a feature the other had.
- The agent's real session id is surfaced the moment a turn starts, not only when it ends, so the handle for resuming the conversation survives a stop or crash mid-turn.
- The spending stops fire after the turn that crossed the line — its cost is already spent — so the point is stopping the next one; an agent that reports no price can never trip the budget cap.
- An unreadable quota never stops the work: a failing quota check means carry on.
- One shared classification of how a run ended — user stop, budget cap, declined plan, quota pause (which leaves a note to resume from), or a real failure — so every surface agrees on what "stopped" means.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
