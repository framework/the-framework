# Decisions

- Publishing is the person's act, across every package: no skill, no cleanup at a run's
  end, no `orchestration land` and no main agent pushes a branch, a ref or a pull request
  by itself. Two things still reach origin without a click, both on purpose: a command
  whose own text asks for the push and the pull request (the scheduled ones do), and
  each run's record, which goes to `agent-data`. Why: whatever lands on origin is in
  front of everyone who watches the repository, and before this every run published
  just by ending. New code that touches origin needs the person's ask behind it. (#1910)
- The chat recognises "a subagent ended" by the opening words of the runner's message
  (`The run <id>, started for this run, ended …`), and only when `<id>` is one of the
  run's own subagents. The clean way, a `from` on the inbox line carried through the
  driver contract to the log, was left out on purpose: it touches three packages and
  every driver. Rewording the runner's sentence turns those rows back into YOU
  messages and breaks nothing else; do the `from` then, not a second pattern. (#1907)
