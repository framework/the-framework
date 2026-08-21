Decides how much of the account's weekly allowance The Framework may have spent by now: the share of the week that has already elapsed.

## User Stories

- The user's asked-for work is never starved by the quota; only unattended work stands down when the week's spend passes its pro-rated share.
- The user moves one slider to give unattended work more or less headroom — there is nothing else to configure.

## Flows

- One policy, nothing to configure: the boundary rises continuously with the clock and reaches the full allowance exactly as the week resets, so a quiet week still gets spent instead of expiring.
- Work the user asks for may borrow ahead; unattended work stands down once usage passes the limit — the boundary plus an optional user-set offset (by default a small cushion beyond it).
- Where the week stands is recovered from the reset time the coding agent prints as prose; prose that cannot be placed means "we don't know", never a boundary of zero.
- Both the account's overall week and the selected model's own week are measured, and whichever reaches the limit first is what stops the work.

## Rationales

- Continuous rather than stepping once a day: a step hands out a whole day's allowance the instant a new day begins, inviting a burst; continuous stays honest about what has actually elapsed.
- The limit and the boundary are separate values because moving the user's slider must not redraw the boundary it is measured against.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
