What the tests cover, for how a tool call reads in the transcript (`tool-calls.ts`):

- **Claude Code's tools** - a command reads "Ran" and the command; a file read reads "Read" and the file's name alone, with the whole path kept; an edit reads "Edited", a written file "Wrote" and counts as an edit; a search reads "Searched"; a skill reads "Used skill".
- **Codex's kinds** - a command reads "Ran"; a change of two files reads "Edited" and both names, with both paths kept; a call of a tool on a server reads "Called"; a web search reads "Searched the web".
- **A label the map does not know** - a camel-case kind reads as words with a capital first; any other name reads as it is, with its detail as the target.
- **A call still going on** - each verb of Claude Code's tools and of Codex's kinds has its form for a call still going on ("Running", "Reading", "Editing"); a label the map does not know keeps its one form.
- **No detail** - the call has a verb and no target.
- **A path ending in a slash** - its last part is still its name.
- **Counts** - one command reads "Ran 1 command", two read "Ran 2 commands", Claude Code's and Codex's counted together; several kinds are counted in the order they first came, each singular for one.
