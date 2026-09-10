Reads tickets off the `tickets/` directory of the `agent-data` branch [1] into rows: what the head of each ticket's markdown says about itself (title, summary, priority, topics, GitHub link, date) plus what the plan and the claim [2] beside it add (planned, locked, holder [3], effort, uncertainty). The same reader serves the `tickets` command's `list` and `show` and the daemon, which serves the dashboard's ticket rows and runs the routines, whether the directory is a checkout on disk or a tree read straight off the branch without a checkout; it also reads `tickets/meta.json`, the stamp of the last issue import.

## Context

**User story**: the user opens a project's tickets in the dashboard and reads each ticket as one row: its title, a one-line summary, its priority, its topics, the GitHub issue it tracks, its date, whether it has a plan, who holds it, and the plan's effort and uncertainty ratings. An agent [4] runs `npx tickets list` and `npx tickets show <file>` and gets the same fields. Tickets are written by hand, by agents and by an issue import, and some predate the ticket format, so every field is read tolerantly: a ticket missing a field still lists, with whatever it has.

**Business logic story**: the ticket format itself is fixed by the skill's `SKILL.md`; which names count as tickets and which as siblings [5] is decided by the gates in `names.ts`; the claim's one line is parsed by the rule in `locks.ts`.

## Glossary

[1] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[2] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[3] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] sibling: a ticket's plan file (`<name>.plan.md`) or claim file (`<name>.lock.md`), written about the ticket and never a ticket of its own.
[6] key block: the `key: value` lines above a ticket's or a plan's `# ` heading, where `Priority:`, `Topics:`, `GitHub:`, `Effort:` and `Uncertainty:` are read from.

## Business logic — TL;DR

- **What a ticket's row holds** - one row per ticket, the same fields for `list` and `show`: file, title, summary, date and whether planned always; priority, topics, GitHub link, locked, holder, effort and uncertainty only when they have a value.
- **The key block above the title** - `Priority:`, `Topics:` and `GitHub:` are read only from the key block [6], the lines above the `# ` heading, keys matched in any case; any other line there is noise.
- **The title, else the filename made readable** - the first `# ` heading is the title; without one, the filename without `.md`, percent escapes decoded and underscores turned into spaces.
- **The summary is the first prose line** - the first line after `## TLDR` that is not blank, not a heading and not a `Source:` line; without a `## TLDR`, the first such line after the title; empty when there is none.
- **A ticket's date, and newest first** - the `yyyy-mm-dd` the filename starts with, at midnight UTC; else the file's modification time; else the Unix epoch; a listing is ordered newest first.
- **A plan and a claim fold into their ticket** - `.plan.md` and `.lock.md` files are never rows of their own; they mark their ticket as planned and as locked, the claim's holder shown only when its line parses.
- **The plan's effort and uncertainty ratings** - `Effort:` and `Uncertainty:` above the plan's heading, each a whole number from 0 to 10, else absent, never clamped.
- **Listing a directory** - every `.md` that is not a sibling and can be read, parsed from its head only; a missing directory lists nothing; `meta.json` and other files are ignored; "any ticket at all" is answered from the listing alone.
- **One ticket by name** - only a name passing the bare filename gate, and only when the file exists; the answer carries the ticket's whole text.
- **The last-import stamp** - `tickets/meta.json` records when the tickets last caught up with the issue tracker; every way the file can be unusable reads as "not known".

## Business logic

### What a ticket's row holds

#### Context

See `## Context`.

#### Business logic

A row names the ticket by its filename inside `tickets/`, which is also its identity, and always carries the title, the summary (an empty string when the ticket has none), the date, and whether a plan sits beside it. The other fields appear only when they have a value and are absent otherwise, never null or empty: the priority as written, lowercased but otherwise verbatim (the format says a whole number from 0 to 10, but the row does not check it; the number the agent queue uses is derived by the rule in `names.ts`); the topics as bare tags; the GitHub link as its label and its URL; locked, present and true only when a claim [2] exists; the holder [3] the claim names; the plan's effort; the plan's uncertainty. `show` adds the ticket's whole markdown. `list` parses only a ticket's head, its first 4,000 characters, because nothing below the head is shown in a list.

### The key block above the title

#### Context

**Problem**: `Priority:`, `Topics:` and `GitHub:` are plain text lines a ticket's body could also contain, so reading keys out of the body would turn a sentence that mentions "priority:" into a field. Restricting keys to the lines above the title keeps the format unambiguous while staying tolerant of tickets written before it.

#### Business logic

The lines above the first `# ` heading are the ticket's key block [6]; a ticket with no heading has no key block, so none of the keys are read. In the key block, a line whose lowercased text starts with `priority:`, `topics:` or `github:` gives that key its value: the text after the colon with surrounding whitespace removed, the first such line winning. A `Priority:` value is lowercased and kept as written (`High` becomes `high`, `7` stays `7`); an empty value counts as absent. A `Topics:` value drops one leading `[` and one trailing `]`, then splits on commas into trimmed tags with empty tags dropped, so `[dx, ui, docs]` and `dx, ui, docs` both give three topics; a value with no tag left counts as absent. A `GitHub:` value gives a link only when it holds a markdown link, `[label](url)`: the first such link's label and URL are kept as written, the label never re-derived from the URL; a `GitHub:` line without a link gives no link. Any other line in the key block, such as a leftover `Status:` line, is noise and never a field.

### The title, else the filename made readable

#### Context

**Problem**: tickets imported from an issue tracker can be named `<number>-<escaped title>.md` and may lack a heading; a list must still show something a person can read for them.

#### Business logic

The title is the text of the first line starting with `# `, trimmed; a heading with no text counts as none. Without a title the filename stands in: `.md` is dropped, percent escapes are decoded (`%20` becomes a space; a name that cannot be decoded is kept as is), and every underscore becomes a space, so `2026-07-20_no_heading.md` shows as "2026-07-20 no heading" and `1-100%_sure.md` as "1-100% sure".

### The summary is the first prose line

#### Context

**User story**: a list row shows the ticket in one line, which is exactly what the format's `## TLDR` section is for.

#### Business logic

When the ticket has a `## TLDR` heading (matched in any case, surrounding whitespace ignored), the summary is the first line after it that is not blank, does not start with `#` and does not start with `Source:`, trimmed. The search scans past later headings, so an empty TLDR section yields the next section's first prose line. Without a `## TLDR`, the same search runs on the lines after the title and, for a ticket with no title, on the whole ticket from its first line. A ticket with no such line has an empty summary. `Source:` lines are skipped because imported tickets end with one: they are provenance, not a summary.

### A ticket's date, and newest first

#### Context

**Problem**: a modification time moves every time a ticket is merely edited, and a ticket read straight off the branch has no modification time at all; the filename's date is the one true "when" of a ticket.

#### Business logic

A filename that starts with `yyyy-mm-dd_` (four digits, a dash, two digits, a dash, two digits, then an underscore) dates the ticket at that day's midnight UTC, whatever the file's modification time. A filename without such a prefix falls back to the file's modification time and, when even that is unknown, to the Unix epoch (`1970-01-01`), so the ticket sorts last instead of failing. A listing is ordered newest first by that date; tickets of the same date keep alphabetical order by filename.

### A plan and a claim fold into their ticket

#### Context

**Business logic story**: a claim [2] is written by `tickets claim` and lifted by `release` or `close`, by the rules in `locks.ts`; a plan is written by `tickets put`. Both are files about a ticket, and a listing that showed them as tickets would double every planned or held ticket.

#### Business logic

A `.plan.md` or `.lock.md` sibling [5] never becomes a row of its own; a lone plan or claim with no ticket beside it is not listed at all. Its ticket's row is planned when the plan exists and locked when the claim exists. The claim's existence is what locks: the holder [3] is read from the claim's `CLAIMED: <holder>` line, by the rule in `locks.ts`, and shown when that line parses; a claim that cannot be read, or whose line does not parse, still locks the ticket, only without a holder. A ticket can be planned and locked at once, because the claim covers a ticket's whole life, planning it as well as implementing it.

### The plan's effort and uncertainty ratings

#### Context

**User story**: the dashboard, and the routines that pick which tickets to plan or work, read a plan's `Effort:` (0 trivial, 10 takes months) and `Uncertainty:` (0 an obvious implementation, 10 highly uncertain) off the ticket's row; the uncertainty is what tells whether a human is needed.

#### Business logic

`Effort:` and `Uncertainty:` are read from the plan's own key block [6], the lines above the plan's first `# ` heading (a plan with no heading is all key block), keys matched in any case, the first line per key winning, within the plan's first 4,000 characters. A value counts only when it is a whole number from 0 to 10. A fraction (`2.5`), an out-of-range number (`15`), a word, or a key written below the heading yields no rating, never a clamped one: a rating that is not on the scale is a typo, and inventing one would hide it. An unplanned ticket has no ratings.

### Listing a directory

#### Context

See `## Context`.

#### Business logic

The tickets of a directory are its files ending in `.md` that are not siblings [5], each read and parsed from its head; a file that cannot be read is skipped rather than failing the listing. Files that are not markdown (`notes.txt`) and `meta.json` are ignored. A directory that does not exist lists nothing. Whether a directory holds any ticket at all is answered from the listing alone, without reading a file: a directory holding only a plan and a claim, only stray files, or nothing, holds no ticket.

### One ticket by name

#### Context

**Problem**: the name comes from outside (a command argument, a browser), so it must never reach beyond `tickets/`, nor read a plan or a claim as a ticket.

#### Business logic

A single ticket is read by its bare filename, only when the name passes the bare filename gate of `names.ts`: a sibling's [5] name, `meta.json`, a relative segment (`../thing.md`), an absolute path or a nested path yields no ticket, and so does a name that passes the gate but has no file. The answer is the ticket's row plus its whole markdown, the row parsed from the whole text rather than from the head.

### The last-import stamp

#### Context

**Business logic story**: the daemon imports the project's issues as tickets with code of its own and stamps `tickets/meta.json` with the moment the import began, so the next import can ask only for what changed since. No `tickets` command reads the stamp; only the importing daemon does.

#### Business logic

`tickets/meta.json` holds one key, `lastImportedAt`: the moment the last import began, as an ISO 8601 UTC timestamp. Reading it yields the stamp only when the file exists, is JSON, is an object, has the key, and the key's value is a string that parses as a date. Every other case reads as "not known": a missing directory or file, text that is not JSON, a JSON string or `null`, an object without the key, a number, or a string such as `"soon"`. "Not known" is true and harmless, whereas failing over an optional file is not. Only the file's first 10,000 characters are considered, so a junk file is never read whole.
