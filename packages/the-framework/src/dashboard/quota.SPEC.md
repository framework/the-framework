Feeds the dashboard's usage panel: the account's quota windows and where they stand against the spending boundary (the line past which unattended work stands down). It also answers, for work about to start, where the account stands once the model that work will run on is named.

## User Stories

- The user sees where the account's quota stands at any moment, agent running or not.
- The user moves the spend-limit slider and both the panel and automation follow, with no restart.
- The user can tell a stale or missing reading from real zero usage.
- The user's unattended work is held back when the model it would run on has spent that model's own weekly allowance, even while the account still has allowance left.

## Flows

- The daemon polls for the dashboard's whole life, not just while an agent is up — the panel must answer while nothing is running.
- A failed reading never blanks the panel: the last good reading is kept and marked stale, and "no reading at all" is reported as such rather than as zero usage.
- The boundary is recomputed on every read, because it moves with the clock. The user's spend-limit slider is read fresh each time, so moving it needs no restart. One source feeds both, so the bar the user sees and the line automation obeys cannot disagree.
- Two questions are asked of that one reading. The panel asks where the *account* stands, and names no model: the bar is about the account. Work about to start asks where the account stands *for the model that work will run on*, so that model's own weekly window binds alongside the account's. Naming no model is the account's week alone — with no model chosen, the coding agent picks, and a window nobody can tie to the work must never stop it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
