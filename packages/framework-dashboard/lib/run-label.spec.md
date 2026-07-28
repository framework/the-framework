Names a session for list rows via the fallback chain `intent` → `sessionName` (#326, the agent's own name, also its branch) → `branch` → short-formatted `startedAt`.

## Decisions

- Replaces the old bold "(no prompt)" rows where the only identifying fact (the timestamp) sat in muted side-text: a date is a poor name but a real one, so it goes on the identifying line.
