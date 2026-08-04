The spending policy in one line: unattended work may spend up to the **pro-rated share of the week's allowance that has elapsed** — a boundary that rises continuously with the clock.

## TLDR

- Parses the agent's human-formatted "resets at" prose (two Claude Code spellings, optional minutes/timezone) into an epoch, then computes the boundary from the account's own week.
- Reports which quota window hit its limit, the current boundary, and the effective limit including the user's offset.

## Decisions

- **Nothing to configure** — the boundary derives from the account's own reset cycle. Two properties fall out: nothing is left on the floor (the boundary reaches 100% exactly as the week resets, so a quiet week still gets spent), and low-priority work cannot starve high-priority work (user-requested work borrows against days still to come; unattended work stands down past the boundary plus a cushion).
- The user's offset slider only ever **loosens** the gate.

## Facts

- The consumption guard and poller fail **open**: an agent that cannot report quota (fake driver, Codex) leaves the run ungated, with the per-run `--max-cost` cap still underneath. That is the deliberate opposite of the idle sweep, which fails closed.
- A quota read spawns the whole agent CLI (~5s) and is rate-limited upstream, so polling is slow by design and a last-good reading is kept separate from the latest attempt — a blip never blanks the usage bar into "nothing used".

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
