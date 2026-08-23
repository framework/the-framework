The agent transcript: the event log rendered as a readable conversation, used both for an agent running right now and for replaying a finished one.

## User story

The user watches an agent work, or comes back afterwards to see what it did. They want to read it as a conversation — what they asked, what the agent answered, how far it got — not as a machine log; and where the log records a moment that needed them, they want to act on it right there rather than hunting for the control elsewhere.

## Business logic — TL;DR

- **Every event becomes one human-readable line** - worded exactly as the terminal words it, so the same agent reads the same in both surfaces.
- **The conversation reads as a conversation** - the user's prompt and the agent's replies show their own text as markdown, the user's turns marked "YOU"; a long one clamps to its first line and opens in place.
- **The user's first prompt is hoisted to the top** - the one line they wrote themselves opens the log, and everything it jumped keeps its order behind it.
- **Colour marks only what the eye hunts for** - failures red, the user's own turns blue, a clean finish green; a background wash on exactly those three so they are findable from the scrollbar, and a coloured badge on a few more high-signal kinds. The bulk of the log stays plain.
- **A row that records an interaction is the interaction** - an open gate renders as the answerable choice, right in the flow; an answered one collapses to a card stating what was picked.
- **The latest browser row is the live browser preview** - one screencast, at the point of use; earlier browser rows stay one-liners.
- **Reading beats following** - a live log sticks to the newest row but gives way the instant the reader scrolls up, with a "jump to latest" control to come back; a replay opens at the outcome, not at page one.

## Business logic

### Rows, badges and times

#### User story

See `## User story`.

#### Business logic

Each event is one row: a kind badge on the left, the event's text, and the time it arrived on the right. Consecutive rows of the same kind show the badge and the time only once, at the top of the run — a single agent turn can be hundreds of lines, and repeating the badge on each turned it into noise. The user's own prompt breaks out of the agent's group so it always gets its own "YOU" badge. Replayed events were never received live, so they carry no arrival time. Hovering a time shows the full date.

The framework's own system prompt is not spelled out inline: its row states how many characters were sent, with the full text one click away.

### The conversation

#### User story

The prompt and the agent's answers are the parts a person actually reads; everything else is context around them.

#### Business logic

The user's prompt and the agent's replies show their own raw text rendered as markdown, since both are written in markdown. A short message is shown in full. A long one — measured on its text with whitespace collapsed — clamps to its first line with a chevron beside it, and clicking either the chevron or the line expands it in place, so the opening is never repeated above the full text.

The user's *first* prompt is moved to the top of the log. It is emitted after the session and system-prompt events, so the one line the reader wrote themselves used to open three rows down, underneath a character count of a prompt they did not write. Only the first prompt moves; a later prompt is part of the conversation and stays where it happened.

### What reads as a failure

#### User story

A user scanning a long log needs to spot instantly whether something went wrong — and must not be alarmed by an agent they stopped on purpose.

#### Business logic

Three things read as a failure, in red: the driver erroring mid-flight, an error the agent reported about itself, and an agent settling badly. An agent the user stopped is none of these — the user asked for it — so it stays neutral rather than being coloured like a fault.

On top of that, the badge alone is coloured for a few high-signal kinds so the log can be scanned by kind: the user's decisions amber, the milestones (a clean finish, ready for merge) green, and the surfaces the agent pushes to the user (a view, a browser stream, a preview) in the accent colour. Everything else stays muted — if every row shouts, none does. A handoff stays muted because its own text reports each rung's outcome, which may be mixed.

A faint background wash is applied to only the three rows the eye actually hunts for — the user's own turns, which are the log's natural chapter marks, failures, and the agent landing cleanly — so they can be found from the scrollbar's distance, where a coloured badge word cannot be seen.

### Answering a gate from the transcript

#### User story

The agent parks on a question. The user is reading the log at that point; making them go elsewhere to answer breaks the thread.

#### Business logic

When the transcript knows which project it belongs to, a gate's row becomes the gate itself. A gate still open renders as the answerable choice, and only the newest open gate is the active one. A gate already answered collapses into a card stating the question and the pick, and the separate line that reported the resolution is hidden, because the card says it better.

Only the last firing of a given gate is treated this way: a gate that fired again supersedes its earlier firing, and earlier firings keep their plain text — they are the only record of a superseded decision. A resolution recorded before a firing answered that earlier firing, so it is never shown as this one's answer. A gate that was closed by the agent ending without ever being answered also stays plain text: its audience is gone, and a control nobody reads must not look answerable.

### The browser preview in the flow

#### User story

The agent opens a page — a login wall, a captcha, a preview of what it built — and the user needs to see and drive it without leaving the transcript.

#### Business logic

When the transcript knows both its project and its agent, the most recent browser row hosts the live browser preview; every earlier browser row keeps its one-line text, because there is one screencast, not one per row. An agent re-announcing a URL it already showed replaces that earlier row in place instead of stacking a duplicate — a continuation re-announces its URL after every session. Once the agent has ended, the preview stops being treated as live, so it degrades rather than pretending to still be a working control.

### Scrolling

#### User story

Two different readers: one watching an agent work, one reading a finished agent's record.

#### Business logic

A live transcript follows the newest row, and yields the moment the reader scrolls up so reading is never yanked away; a "jump to latest" control brings them back, and is inert when there is nothing to scroll. A replay is static and opens at the outcome rather than at the first line, since the outcome is what the reader came for. Each of the user's prompts is an anchor the scroller keeps in view, since it opens a fresh turn. A surface can pin extra content after the last row — for example the live mirror of an agent handed to the cloud — which then scrolls and sticks with the log rather than floating over it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
