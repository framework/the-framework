The accounting every agent shares, whatever kind it is: naming the session, following the agent's progress, and totalling what it spends.

## TLDR

- Lives once because a build and a direct prompt do different work but identical accounting — keeping two copies is how one path once silently lost a feature the other had.
- The agent's real session id is surfaced the moment a turn starts, not only when it ends, so the handle for resuming the conversation survives a stop or crash mid-turn.
- One self-stop, where there were three: an answer that says to stop. The caller's signal and that one are composed, so everything downstream ends the same way whichever fired. The two that went were spending — a per-agent cost cap and a mid-flight quota gate, each firing after the turn that crossed it, when the money was already gone; spending is decided once, before an agent starts, because interrupting mid-flight saves the cheap part and loses the expensive part. The one that stayed is the one a person asked for.
- An unreadable quota never stops the work: a failing quota check means carry on.
- One shared classification of how an agent ended — a user stop, a quota pause (which leaves a note to resume from), or a real failure — so every surface agrees on what "stopped" means.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
