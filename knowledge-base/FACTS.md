# Facts

- A main agent's record says `done` while its subagents still work: its turn ended, it
  waits in no process and is continued as each subagent ends. Only the dashboard shows
  the job as running. Whoever reads the records (`npx logs`) must look at the runs that
  name it as `parent` before taking its `done` as the end of the job. (#1907)
- A subagent can end `done` without having committed its work: it happened in three of
  the eight hand-test runs. Nothing checks it yet (the checker is a later step of
  #1902), so a main agent looks at the subagent's branch before landing it. (#1907)
- A landed subagent's changes are readable only through `refs/landed/<run id>`, which
  exists in the clone that landed it and nowhere else: another machine shows `landed`
  and no files. The ref is never removed, also not when its run is deleted. (#1908, #1910)
