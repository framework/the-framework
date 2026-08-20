The accounting every agent shares, whatever kind it is: naming the session, following the agent's progress, and totalling what it spends.

## Flows

- The agent's real session id is surfaced the moment a turn starts, not only when it ends, so the handle for resuming the conversation survives a stop or crash mid-turn.
- One self-stop: an answer that says to stop. The caller's signal and that one are composed, so everything downstream ends the same way whichever fired.
- An unreadable quota never stops the work: a failing quota check means carry on.
- One shared classification of how an agent ended — a user stop, a quota pause (which leaves a note to resume from), or a real failure — so every surface agrees on what "stopped" means.

## Rationales

- The accounting lives once because a build and a direct prompt do different work but identical accounting — keeping two copies is how one path silently loses a feature the other has.
- Spending never stops an agent mid-flight — no per-agent cost cap, no quota gate between turns: each would fire only after the turn that crossed it, when the money is already gone. Spending is decided once, before an agent starts, because interrupting mid-flight saves the cheap part and loses the expensive part. The one self-stop is the one a person asks for.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
