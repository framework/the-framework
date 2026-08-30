What the tests cover: reading a folder of tickets, on disk and over a git-style seam.

- **An empty read** - a folder that does not exist reads as no tickets.
- **The format** - the keys above the title (`Priority:`, `Topics:`, `GitHub:`), the title, and the `## TLDR` line as the summary; the GitHub link split into its label and its URL, and left off when there is none; a multi-topic list read with its cosmetic brackets stripped, and left off when there is none.
- **A ticket's date** - the filename's date wins over a later edit's modification time; a filename with no date falls back to the modification time, and to the epoch when the seam has none.
- **Order** - newest first.
- **Tolerance** - a ticket written before the format still lists, with its title, its first prose line and no priority; a ticket with no heading is titled from its filename, escapes decoded; an unrecognised key is preamble noise, not a field.
- **The siblings** - a `.plan.md` marks its ticket planned and is never a row of its own; a `.lock.md` marks its ticket claimed, names the holder, and is never a row of its own; a ticket can be planned and claimed at once; a malformed lock still locks, just without a holder.
- **The plan's scales** - `Effort:` and `Uncertainty:` read from the plan's preamble only, on the 0–10 scale only: out of range is not clamped, fractional is not a value, and a key in the body is not a preamble key.
- **What is not a ticket** - a non-markdown file and `meta.json` are ignored; asking whether a folder holds any ticket agrees with the listing for a missing folder, a lone plan or lock, a stray file, and a real ticket.
- **One ticket in full** - the row plus the entire markdown; nothing for a missing file, a sibling, `meta.json`, or a name that escapes the folder.
- **The last-import stamp** - read when it is a usable date; "not known" for a missing folder, a missing file, content that is not JSON, a string, null, no stamp, a stamp that is not a string, and one that is not a date.
- **The git-style seam** - the same reader over relative paths and no modification times gives the same rows.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
