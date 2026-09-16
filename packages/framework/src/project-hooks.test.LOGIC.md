What the tests cover, with real shell lines in a throwaway project:

- **The file** - open and close lists parse to their lines; an empty document is no hooks; a document that is not a map, an unknown key, a value that is not a list, and a list holding a number are each refused with the message naming what is wrong; a missing file reads as no hooks with no warning; a file YAML cannot parse reads as no hooks with one warning starting "ignoring".
- **The lines run in order, in the project, through the shell** - the lines leave their traces in a file in the project in the order written, the working directory is the project's root, a line that exits 3 is logged as such with what it said on stderr under it, and the next line still runs; the close lines are separate from the open lines.
- **A hanging line is bounded** - a line that sleeps past the bound is killed, logged as timed out, and the next line runs.
- **Nothing to run** - no file runs nothing and logs nothing; a broken file logs why it was ignored and runs nothing.
