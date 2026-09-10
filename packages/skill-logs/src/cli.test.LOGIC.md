What the tests cover, against a bare `origin` holding the `agent-data` branch and clones standing in for agents:

- **The bare command** - lists every person's runs off origin, newest first, with the skill's fields only and never `caller`; `--ticket` finds a run by the ticket's file name or by its full path and yields an empty list for a ticket nobody worked; `--branch` keeps one branch's runs; `--limit` caps the list, and the cap counts the runs kept after the filters; nothing lands in the clone: no local copy of the branch and a clean status.
- **The default cap** - the newest 20 runs are printed unless `--limit` asks for more.
- **`show`** - prints the card with the agent's four kinds of diary line (extra fields kept) and never the writing program's lines; a run with no diary file shows an empty diary; an unknown id exits 1 with `{ "ok": false, "reason": "no-run", "id": … }` and "no run is named" on stderr.
- **Usage errors** - an unknown command exits 2 with the usage alone on stderr and nothing on stdout; `--limit 0`, `--limit many`, an unknown flag, `show` without an id, `show` with two ids and `show ../escape` all exit 2; a branch with no runs yet lists as an empty array.
- **No remote, no repository** - a repository without a remote reads its local branch; outside any repository the command exits 1 with the refusal `not-a-repo`.
