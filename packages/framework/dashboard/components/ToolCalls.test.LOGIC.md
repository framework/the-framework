What the tests cover, for the folded line of the coding agent's steps (`ToolCalls.tsx`):

- **A lone call** - it is its own line, a button named by its verb and target ("Read AGENTS.md"), the verb grey and the target dark, with no count; it opens to the whole path and folds again.
- **A call with no detail** - it reads as its verb and is no button, unless it gave something back: then it opens to that output alone.
- **An opened command** - it shows the command whole, its lines kept, with "$" in front, and under it what it printed, in a box with a height limit that scrolls; nothing says it failed.
- **An opened file read** - its path has no "$", and what the call gave back is under it.
- **A failed call** - it says "Failed: exit code 3" with its exit code and has no empty output box, and "Failed" over its output when it has no code.
- **Several calls** - they are one folded line counting them ("Ran 2 commands"), showing no command until opened.
- **The opened box** - it holds one line per call, in order; a call inside opens to its detail; a second click on the counting line removes the box.
- **Codex** - a command and a file change of Codex's read "Ran 1 command, edited 1 file", and each line inside reads with its verb.
- **A thought** - it shows nowhere while the line is folded; opened, the box holds a "Thought" line at the thought's place, before the call that followed it, and that line opens to the thought.
- **Thoughts alone** - a run with no call draws nothing.
- **The line going on now** - given a call, it is a status reading the call in the present ("Reading AGENTS.md"), verb and target shimmering, behind three dots, and not the word; it opens to its detail; given when the call began, it counts the seconds, one more each second, and reads "1m 5s" past a minute; given no time, it counts nothing; given no call, it is the word, shimmering, with its seconds and the dots.
- **Edits whose files are known** - three commands and a call that made a file are one folded line named "Ran 3 commands, created DESCRIPTION.md +11 −0", the lines added in green and the lines removed in red; that call alone is its own line, named "Created DESCRIPTION.md", with its size after the name; a run whose edit says no file reads "Ran 1 command, edited 1 file" with no size.
