One shared reading of what a finished agent's branch has to hand off — push, open a PR, merge — feeding both the action bar's summary and its expanded detail so the two can never disagree.

## TLDR

- Not read while the agent is still running: a branch still being written to has nothing to hand off yet.
- Re-asked slowly at rest, and quickly while the PR lookup is still out, since that answer decides which buttons to offer; the last answer stays on screen across the cadence switch instead of blanking.
- Each action names itself while in flight ("Pushing…" rather than a silently greyed button) and refreshes the answer the moment it lands, so the offer follows the action immediately.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
