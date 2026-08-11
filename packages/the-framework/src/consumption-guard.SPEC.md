The per-run spend gate: polls the agent's own account quota during a run and pauses the run once the account is past its share of the week — a comparison of two numbers the agent reports, so there is nothing to configure and nothing to remember across restarts.

## TLDR

- Fails open everywhere — an agent that cannot report a quota, or a reading that fails, leaves the run ungated — because no reading must never stop work the user asked for; the deliberate opposite of auto PM's gate, which spends unasked.
- A half-day cushion keeps a fresh week's first whole-percent report from pausing the user's very first run over rounding.
- The user's spend slider joins this gate only when it loosens it — the usage bar and the gate must never disagree, but pulling the slider down governs unattended work, not the user's own — and it is re-read around each check so a drag unblocks a parked run without a restart.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
