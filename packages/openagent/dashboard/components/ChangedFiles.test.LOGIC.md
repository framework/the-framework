What the tests cover, for the rows of the files a turn changed (`ChangedFiles.tsx`):

- **A row for each file** - the list is named "Files changed" and holds one row per file, in order, each reading the file's name and its lines added and removed ("DESCRIPTION.md+11 −0"); the name has the file's whole path on hover.
- **A click** - a click on a file's row, a button named "Show the change to app.ts", asks for that file by its path.
- **Nothing to open a change in** - with no way to show a change, no row is a button, and the files' names are still there.
