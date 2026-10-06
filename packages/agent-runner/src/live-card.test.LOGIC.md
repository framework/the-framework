What the test covers, against real files:

- **Where a run's live files are** - the live directory of a checkout is `.openagent/` in it, and the inbox is `inbox.jsonl` there. The name is said as the literal, because the dashboard reads a working agent's card and diary there by the same name, written in its own package.
- **Hidden from git in that checkout** - hiding the live directory writes a `.gitignore` of `*` inside it, and keeps a `.gitignore` already there as it is.
