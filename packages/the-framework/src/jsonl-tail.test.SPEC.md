What the tests cover: following a journal survives everything that can go wrong underneath it, and never pins the process open.

- A read that fails does not take the process down: following keeps re-reading through repeated failures and resumes delivering entries once the failure clears.
- When the file-change notifications break, they are dropped without crashing and the periodic re-read alone keeps delivering newly appended entries.
- When following is asked not to hold the process open, the process really can exit — the file-change notifications are released as well as the periodic timer, not just the timer.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
