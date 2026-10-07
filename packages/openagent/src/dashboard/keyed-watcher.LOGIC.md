The baseline behind the browser notifications of both feeds, the interventions [1] feed and the activity feed: given each read of a feed, it remembers what it has already seen and hands out only what is new, so a notification fires once per item and never for what already existed. The two feeds differ only in how an item is identified, so that is a parameter; the per-project baseline and the rules for a partial read are written once here. When a read happens is the dashboard's business, not this module's.

## Context

**User story**: the user is told in the browser when something new needs them or when an agent [2] starts or finishes; what already existed when the page opened is never announced, and a repository that cannot be reached neither floods the user later with everything it already held nor silences the other projects.

**Problem**: the reads underneath a feed forgive their own failures, so a read made while the git host is unreachable succeeds with an empty list. Taken as a baseline, that empty list would make the next good read announce every pre-existing item as new; taken as "seen", it would hide nothing, since it saw nothing. The tracker therefore separates two facts: which items a read saw, and which projects it read completely.

## Glossary

[1] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.

## Business logic — TL;DR

- **Only what is new, per project** - an item is announced when its identity has not been seen before and its project has earned a baseline; every item seen is remembered either way.
- **A project's first whole read seeds, never announces** - a project earns its baseline the first time a read covers it completely, and the items found in that read are what already existed, not news.

## Business logic

### Only what is new, per project

#### Context

See `## Context`.

#### Business logic

Each read hands over the current items of every registered project along with the list of projects read whole, the ones whose share of the items is all of it rather than all that could be reached. An item is new, and handed back to the caller, only when two things hold: its identity (the caller's rule, for instance a pull request's URL) has never been seen by this tracker, and the project it belongs to already had a baseline before this read. Every item the read saw is then remembered as seen, whether or not it was announced and whether or not its project has a baseline: a partial read can only under-report, never invent, so anything it did see is something the user must not later hear about as new. The baseline is held per project, not once for the whole read: a read that reached three projects out of four knows what already existed on those three and nothing about the fourth, and announcing is a per-project decision anyway. Held globally, one project that can never be read (a registered repository with no remote is an ordinary case) would either silence every project's notifications or hand the whole set a baseline it had not earned.

### A project's first whole read seeds, never announces

#### Context

**Problem**: what is already open when the page opens is not news, and neither is what a project already held when it becomes reachable later.

#### Business logic

Only a project that a read covered whole earns a baseline, and it earns it after that read's items have been judged: the items found in a project's first whole read are folded in as seen and none of them is announced. From the next read on, the project's new items are announced. A project that a read could not cover whole stays without a baseline until a later read does, and anything found for it in the meantime is remembered but never announced. So a readable project keeps announcing while another cannot be read, and the unreadable project's pre-existing items stay quiet when it comes back. A read that covers no project whole, which is what a page opened without git host reach sees, earns no project a baseline.
