# Insights

- A package's `DECISIONS.md` goes stale when later work adds a command without
  revisiting it: the tickets one still said "no command reads `meta.json`" long after
  #1785 added `meta` and `put meta.json`. Read it against the code when touching the
  package. (#1838)
- A skill file is checked by running every command in it as written, from a plain
  clone with a local origin so the real `agent-data` branch is never written, then
  having a fresh reader read it against the code. The fresh read found misstatements
  the runs did not. (#1838)
