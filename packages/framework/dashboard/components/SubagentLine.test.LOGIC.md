What the tests cover, for the subagents line above the message box (a single subagent's line is covered where the transcript shows it, by `EventList.test.tsx`):

- **While a subagent works** - with two of three subagents running, the line reads "Subagents · 2 of 3 running" and lists nothing until it is opened; opened, a working subagent's line says what it is doing now, an ended one's its status and how long it took, and a click on a subagent's task opens that subagent.
- **With no subagent working** - there is no line at all: with no subagents, and with one done and one only waiting.
