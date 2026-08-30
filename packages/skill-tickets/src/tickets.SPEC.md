The read side: what a ticket says about itself, and what the plan and the claim beside it add. Reads a folder of tickets through a small filesystem seam, so the same reader serves a checkout on disk and a branch read straight off git — a caller with a persistent checkout and a command holding none get identical rows.

## User story

- The user opens the roadmap and sees every open ticket: its title, its one-line summary, its priority and topics, the issue it tracks, whether it has a plan, and whether someone is already on it.
- An agent asks for one ticket and gets its whole text.

## Business logic — TL;DR

- **A ticket's row** - the head of its markdown: the optional `Priority:`, `Topics:` and `GitHub:` keys above the title, the `# ` heading, and the `## TLDR` line.
- **A ticket's date** - its filename's date, else when the file was last written, else the epoch.
- **What the siblings add** - a `.plan.md` marks the ticket planned and contributes its `Effort:` and `Uncertainty:`; a `.lock.md` marks it claimed and names the holder.
- **Deliberately tolerant** - a ticket written before the format still lists, with whatever it has.
- **One ticket in full** - the same row plus the entire markdown, for a reader that wants the ticket itself.
- **The last-import stamp** - when the tickets last caught up with the issue tracker, or "not known".

## Business logic

### A ticket's row

#### User story

See `## User story`.

#### Business logic

A ticket lists as: its filename, which is also its identity; its title, from the `# ` heading; its summary, the first line under `## TLDR`, or the first prose line when the ticket has no TLDR, or empty when it has neither; its `Priority:` verbatim, as written; its `Topics:`, as bare tags with the list's cosmetic brackets stripped; and its `GitHub:` link split into the text a reader clicks and the URL it goes to. The three keys are optional, and are read only from the block *above* the title, so a key-looking line in the body is prose. Only the head of each ticket is read — nothing below it is shown in a list.

The tickets come back newest first. A `.plan.md` or `.lock.md` never becomes a row of its own.

### A ticket's date

#### Business logic

A ticket's date is the date in its `<DATE>_<SLUG>.md` filename — the format every ticket is written in, and the one true "when" for a ticket, unlike a modification time, which moves every time the file is merely edited. A ticket whose filename carries no date falls back to when the file was last written, and to the epoch when even that is unknown (a read off git, which has no modification times), so it sorts last rather than failing.

### What the siblings add

#### Business logic

A `.plan.md` beside a ticket marks it planned, and its preamble — the keys above the plan's own heading — contributes the plan's `Effort:` and `Uncertainty:`, each a whole number 0 to 10. A value out of range or fractional is left off rather than clamped into something plausible, which would hide the typo; so is a key that appears in the plan's body instead of its preamble.

A `.lock.md` beside a ticket marks it claimed, and the holder it names is reported. The lock's *existence* is the claim; the holder is display sugar, so an unreadable or malformed lock still locks. A ticket can be planned and claimed at once — the claim covers the ticket's whole life, planning it or implementing it.

### Deliberately tolerant

#### User story

- The user's older tickets, written before the format existed or imported from an issue tracker, still show up in the roadmap.

#### Business logic

Every part of the format is optional to the reader. A ticket with no heading is titled from its filename, made readable by decoding any escapes and turning underscores into spaces — which covers both `<DATE>_<SLUG>.md` and a `<number>-<escaped title>.md` name from an issue tracker. A key nobody recognises is preamble noise, not a field. Asking whether a folder holds any ticket at all is a listing, not a parse, for a caller that asks often.

### One ticket in full

#### Business logic

One ticket by filename comes back as its row plus its entire markdown. Nothing comes back when the name is not a bare ticket filename, when it names a sibling rather than a ticket, or when there is no such file.

### The last-import stamp

#### Business logic

`tickets/meta.json` records the moment the last catch-up with the issue tracker began. Every way the file can be unusable — no file, not JSON, not an object, a stamp that is not a usable date — lands on the same answer, "not known": that is true and harmless, whereas failing over a malformed optional file is not.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
