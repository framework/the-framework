Tests of `turn-changes.ts`.

- **A path said from the checkout** - a path inside the checkout's folder is said from it, also when the folder is given with a slash at its end; a path elsewhere, a path in a folder whose name only starts with the checkout's, and any path while the folder is not known are left as they are.
- **One list per turn** - each turn's files are under the prompt that ended it and the last turn's are apart; a turn that changed no file has no entry.
- **Each file once** - a file edited several times in a turn is one file with its edits summed, and the files are in the order first changed.
- **A file the turn made** - it holds its lines added less the ones removed again, and removed none.
- **A file made in an earlier turn** - it is a file that was there: a later turn sums its edits as they are.
- **Nothing to say** - an output that says no file it changed, and a log with no event, give no list.
- **Edits before any prompt** - they belong to the turn the first prompt ends.
