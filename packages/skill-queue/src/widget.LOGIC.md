The rules of the package's dashboard widget [1] (`../dashboard/`), kept apart from React so they are tested like the rest of the package: how a queue entry [2] reads on a dashboard, and what the "Add to queue" action runs for the links [3] a dashboard page hands it.

## Context

**User story**: on the dashboard's Queue page a queued ticket reads as its title, not as the markdown link an agent wrote; on a ticket's page "Add to queue" writes the very line the `tickets` skill tells an agent to write, `[<title>](tickets/<file>)` at the ticket's priority, so the queue looks the same whoever queued.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard, offers actions on the links its pages show, and reads and changes its data through its own package's command.
[2] queue entry: an item on the agent queue: plain trimmed text, or a markdown link back to what it came from.
[3] link: the name of some work and where it points, as a dashboard page shows it: a text, an optional target (a path inside the project's repository, or an absolute URL; absent for plain text that points nowhere) and an optional priority from 0 to 10.

## Business logic — TL;DR

- **How an entry reads** - a leading markdown link's text is the entry's title, and the link opens only when its target is an absolute http(s) URL; any other entry reads whole, trimmed.
- **What a link is queued as** - `[text](href)` when it points somewhere, its plain text otherwise, by `queue add`, with `--priority N` when the page gave a priority.
- **Queueing a batch** - one `queue add` per link, in order, stopping at the first command that could not run or answered a refusal, with its reason; a link already queued is queued again.

## Business logic

### How an entry reads

#### Context

See `## Context`.

#### Business logic

Only a link at the very start of the entry, `[text](target)`, is its title: that is where a queued link is written, and a link further in is part of a sentence. The label's text is that link's text, trimmed; anything after the link (an agent's note) is not shown in the label and stays in the raw entry. When the target is an absolute `http://` or `https://` URL the label opens it; any other target (a path inside the repository, which the widget has no page for) leaves the label pointing nowhere. An entry with no leading link reads as its own text, trimmed.

### What a link is queued as

#### Context

See `## Context`.

#### Business logic

A link with a target is queued as the markdown link `[<text>](<target>)`; a link with none as its plain text. The command line is `queue add <line>`, followed by `--priority <N>` when the link carries a priority, so the entry lands in that `## Priority N` section by the placement rule of `queue.ts`, and at the end of the file otherwise.

### Queueing a batch

#### Context

**User story**: above a list of tickets the user queues all of them at once; when one cannot be queued the rest are left as they are and the reason is shown.

#### Business logic

The links are queued in the order given, one command each, and the outcome is done once every command answered a result. The batch stops at the first link whose command could not run (its error is the outcome's) or whose command answered a refusal, an output whose `ok` is `false`: the outcome is then "the queue refused: <reason>", or "the queue refused" when the refusal names no reason. An empty batch is done. A link that is already on the queue is queued again: what counts as a duplicate is the caller's to decide, since only the caller knows what its links name.
