Reads a project's tickets so the dashboard can show the roadmap The Framework plans from without anyone opening the repo: one row per ticket with its title, one-line summary, priority, topics, linked GitHub issue, date, and whether it is already planned or currently claimed by an agent — plus a single ticket's full text for its own page.

## User story

The user opens a project's Tickets page and sees its whole backlog: what each ticket is about, how urgent it is, which ones an agent has already planned, which ones an agent is holding right now and who holds them, how much effort and uncertainty the plan recorded, and when `tickets/` last caught up with GitHub. A repo with no tickets at all shows an empty list, which is what the import offer sits on.

## Business logic — TL;DR

- **A ticket is a markdown file in `tickets/`** - its filename is its identity; a `.plan.md` or `.lock.md` beside it is written *about* it and never becomes a row of its own.
- **Tolerant description** - the title, summary, priority, topics and GitHub link are each taken where they exist and quietly skipped where they do not, so tickets predating the format still list.
- **Keys live above the title** - only the lines before the ticket's heading are read as metadata, never the body.
- **The filename is the date** - a ticket dated in its filename keeps that date forever; only a ticket predating the dated-filename format falls back to when the file was last written.
- **Newest first** - the list is ordered by that date, newest first.
- **Planned and claimed** - a plan beside the ticket marks it planned and contributes its recorded effort and uncertainty; a claim beside it marks it locked and names its holder.
- **Only the head is read for a row** - list rows read the top of each ticket; the full text is read only for the ticket's own page.
- **A cheap yes/no** - whether a project has any ticket at all is answered without describing any of them.
- **Nothing throws at the view** - an absent, unreadable or malformed file yields a missing value, never an error.

## Business logic

### What counts as a ticket

#### User story

The backlog view must list the tickets themselves, not the plan and claim files agents write alongside them.

#### Business logic

Every markdown file directly inside the project's `tickets/` directory is a ticket, except those whose name ends in `.plan.md` or `.lock.md`, which are written about a ticket rather than being one. A ticket's filename is its identity. A repo with no `tickets/` directory at all yields an empty list — the state the view offers to import into. A ticket file that cannot be read is skipped rather than failing the list.

Anywhere a ticket filename arrives from the browser, it is accepted only when it is a bare `.md` name with no path segments — so it cannot address another directory — and is not one of those sibling files.

### Describing a ticket

#### User story

Rows must be readable even for tickets that were imported from GitHub long before the current ticket format existed.

#### Business logic

A ticket's title is its top-level markdown heading; without one, its filename is made readable instead — percent-escapes decoded and underscores turned into spaces, which covers both the dated-slug format and the numbered-and-escaped names GitHub imports carry. Its summary is the first line under a `## TLDR` heading, or failing that the first prose line of the body, skipping headings and a trailing `Source:` line; a ticket with neither has an empty summary.

Its priority, topics and GitHub link are read from the `key: value` lines above the heading only, so nothing in the body can be mistaken for metadata. Priority is kept verbatim as written. Topics are split on commas, with the format's surrounding brackets treated as cosmetic rather than required. The GitHub key is a markdown link, kept split into the label as written and the URL it points at — the label is not re-derived, in case the source ever names a pull request differently.

For a list row only the top few thousand characters of a ticket are read, since nothing below that is shown; a ticket's own page reads the whole file.

### The ticket's date

#### User story

The list is ordered by when a ticket came about, and reconciling a ticket against its GitHub issue must not shuffle the whole backlog.

#### Business logic

Every ticket the format describes is named with its date, imports included, and that date — taken as midnight UTC — is the ticket's date. Only a ticket predating that convention falls back to when its file was last written; a file that cannot be inspected at all falls back to the epoch, which sorts last rather than raising an error.

Tickets are listed newest first, which is the only ordering that means the same thing for a dated ticket and a bare imported one alike.

#### Rationale

The filename's date is used in preference to the file's own modification time because the modification time moves every time the file is merely edited — for example when a GitHub update reconciles it — which would keep re-dating a ticket that has not actually changed. A ticket dated by its filename therefore keeps the date it was created on.

### Planned and claimed

#### User story

The user wants to see at a glance which tickets already have a plan, how big that plan judged the work to be, and which tickets an agent is holding right now — including whose claim it is, before deciding to release it.

#### Business logic

A plan file beside a ticket marks it planned. Its preamble — again, only the lines above its heading — may record an effort and an uncertainty, each a whole number from 0 to 10. A value that is missing, not a whole number, or outside that range is simply absent: it is deliberately not clamped into something plausible, because an out-of-range value is a typo and inventing a value would hide it.

A claim file beside a ticket marks it locked, and the holder named inside it is shown so a human can tell whose claim they are about to release. The file's existence *is* the claim: a claim that is unreadable or malformed still locks the ticket, and only the holder's name goes missing. Being locked and being planned are not exclusive — the claim covers the ticket's whole life, so a claimed ticket may also be planned while its agent keeps working.

### Cheap presence and the import stamp

#### User story

The onboarding checklist asks "does this project have any tickets yet?" for every project on every dashboard poll, and the Tickets page wants to say when `tickets/` last caught up with GitHub.

#### Business logic

The presence question is answered purely by looking for a ticket file, without reading or describing any of them, because describing every ticket to answer a yes/no would be paid over and over.

The last-import stamp is read from the metadata file the importing agent writes alongside the tickets it imported. Every possible failure — no file, unreadable, not valid data, or a timestamp that is not a usable date — lands on the same answer: nothing known. Saying "we do not know when this last synced" is true and harmless; failing the view over a malformed optional file is not. The value is validated as a real date specifically because it is rendered as one, and an unparseable string would show as an invalid date in the one place claiming to state a fact.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
