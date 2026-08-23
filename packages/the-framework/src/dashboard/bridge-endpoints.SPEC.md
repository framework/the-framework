The daemon half of the Claude web bridge: the `/_bridge` routes the Chrome extension running inside the user's claude.ai tab talks to, so a cloud session's parked question surfaces in the local dashboard and the confirmed answer travels back to the tab.

## User story

- A `web`-target agent hands its task to a cloud session on claude.ai. The session stops mid-way to ask the user something. Nobody is looking at that tab, so the question would sit unanswered forever — the bridge carries it into the dashboard's open questions instead, and carries the user's pick back to be typed into the tab.
- The user wants to follow what a cloud session is doing without switching to claude.ai: the bridge streams the session's transcript into the dashboard.
- The bridge is two halves that ship separately (extension and daemon), so when it does not work the user needs to be told which half is at fault, not left guessing.

## Business logic — TL;DR

- **Every bridge call presents the daemon token** - this is the one route family meant to be reached from another origin, so it authenticates itself instead of relying on the protections the dashboard's other routes have.
- **Deliberately no cross-origin headers** - the extension's background worker can call without them, and adding them would let any page the user visits reach their daemon.
- **A tiny, fully validated surface** - no path, command, prompt or free text is accepted anywhere, so a stolen token buys at most a bogus question card.
- **The extension version must match exactly** - a mismatched extension is refused outright rather than allowed to half-work.
- **The parked question becomes an open question** - a validated question from a cloud session, in the shape the session asked it, is handed to the dashboard.
- **The transcript arrives as numbered entries** - each message carries its position in the transcript, so re-reading the page overwrites rather than duplicates.
- **The answer is polled, and its delivery reported back** - the extension asks for the exact text to type, which the daemon composed, and then says whether typing it worked.
- **The daemon says which cloud sessions to watch** - the extension only sees tabs the user is already on, so the daemon lists the sessions a tab should be opened for.
- **Every contact is recorded, including refusals** - so the dashboard can show what the bridge is doing.
- **The bridge can be off** - a daemon with the feature disabled answers every bridge route as not found.

## Business logic

### Authentication

#### User story

The bridge is attached to a daemon that spawns processes on the user's machine, and it is the only part of the dashboard designed to be reached by a page from another origin.

#### Business logic

Every `/_bridge` route demands `Authorization: Bearer <daemon token>` and refuses anything else, before reading any request body at all. The token comparison takes the same time whatever the token is, and a wrong-length token is refused without revealing that its length was wrong.

No cross-origin response headers are sent on any bridge route.

#### Rationale

The dashboard's other routes are protected by two things that do not apply here: the extra guard the daemon puts up when it binds to a non-loopback address, and the same-origin check that refuses `/_rpc` calls from a foreign page. A route that is *meant* to be called cross-origin has neither, so it carries its own secret.

Cross-origin headers are omitted on purpose rather than forgotten: an extension's background worker holding host permissions can call the daemon without them, whereas permissive headers would let any web page the user happens to visit post into their daemon. The cost is that the extension must call from its background worker instead of from the page, which is the cheaper side of the trade.

Refusing before the body is read means an unauthenticated caller cannot make the daemon buffer anything.

### The extension version gate

#### User story

The extension and the daemon ship as one feature but update separately. A version-skewed pair does not fail loudly — it half-works, with missed messages and silently ignored fields — which reads as a framework bug and costs a debugging session.

#### Business logic

The daemon declares which extension version it speaks, and the extension states its own version on every call. If the two differ, every route — including the health check — is refused with a message naming both versions and telling the user to update the extension and reload it. There is no degraded mode: updating is the only way forward.

Whatever version the caller claimed, and whether it was turned away, is reported to the dashboard so the state of the bridge can be shown.

The version check runs after the token check, so an unauthenticated caller learns nothing about which version the daemon expects.

### The parked question

#### User story

A cloud session asks its user to choose between options. The dashboard shows it as an open question, the same as a question from a local agent.

#### Business logic

The extension posts the question it scraped, in the shape the cloud session itself asked it: which cloud session asked, the question's title, its options, whether several answers may be picked at once, and optionally which option is recommended. Each option carries its label, an optional one-line detail, whether it starts checked on a multi-select question, and whether picking it means the user is taking over rather than letting the session continue. The daemon stamps the moment it accepted the question and hands it on.

Every field is checked and a rejection says which field was wrong: the cloud session id must have the shape claude.ai uses, the title must be non-empty and within a length limit, there must be at least one option and no more than twenty, each option needs a non-empty label within a length limit, the two option flags and the multi-select flag must be true or false, no two options may carry the same label, and a recommendation must name one of the options actually present. Flags that are false are dropped rather than carried, and fields the daemon does not know are dropped rather than refused, so a newer extension posting an extra field still works against an older daemon.

#### Rationale

A recommendation naming an option that is not in the list would render a default the user cannot see and cannot pick, so it is rejected rather than dropped.

Two options sharing a label are refused because a label is also how a pick names the option it chose — a claude.ai page offers no ids, and the label is the only thing that can be typed back — so two alike could not be told apart.

### The transcript

#### User story

The user watches what a cloud session is doing from the dashboard, without opening claude.ai.

#### Business logic

The extension posts batches of transcript entries for one cloud session: each entry carries its position in the transcript, whether the session or the user said it, and the text. The daemon keeps one copy per position, so a page that is re-read on every change overwrites the entries it already sent instead of piling up repeats.

A batch is accepted whole or not at all: one bad entry rejects the entire batch, because taking only the good entries would leave a gap in the sequence that the reader cannot tell apart from a message that has not arrived yet.

Batch size, entry count, position range and text length are all capped, and over-long text is truncated rather than refused. A daemon that does not collect transcripts reports the route as not found.

### The answer round trip

#### User story

The user picks an option in the dashboard. Something has to type that pick into the claude.ai tab and confirm it landed.

#### Business logic

The extension asks the daemon what answer is queued for a given cloud session, and always gets an answer-shaped reply — the queued answer, or nothing to deliver — so it can poll blindly without treating "nothing yet" as a failure. A daemon that queues no answers replies "nothing to deliver" rather than an error.

What comes back is the answer's identity and the exact text to type: the extension types that text verbatim and decides nothing about it. The text is composed by the daemon out of labels the session itself offered, which is what keeps the whole feature bounded — the only thing this can ever put in a claude.ai composer is a sentence built from that session's own options.

After trying to type the answer into the page, the extension reports back which cloud session it was for, which answer it tried to deliver, whether it worked, and an optional note.

### Which cloud sessions to watch

#### User story

An agent starts a cloud session while the user is looking at something else entirely. The extension only ever sees tabs the user is already on, so without help the bridge would work only by coincidence.

#### Business logic

The daemon lists the cloud sessions worth watching, newest first, each with the address of its page, so the extension can open a tab for one. A daemon that has no list to give answers with an empty list rather than an error, so an extension polling an older daemon quietly does nothing instead of reporting a fault. A failure while building the list is likewise reported as an empty list.

### Diagnosis

#### User story

When the bridge is not working, the user should be able to ask the daemon what the extension is doing rather than being asked for a screenshot of the extension's own panel.

#### Business logic

The extension reports what it injected into the page: its version, which cloud session the page belongs to, and a free note about what its last read of the page found. Unlike everything else on the bridge, this report is accepted leniently — unrecognisable fields become "unknown" rather than a rejection — because its whole purpose is to work when something is already wrong.

Separately, every request that reaches the bridge is recorded with the route it asked for and the status it got, refusals included.

### The bridge can be off

#### Business logic

A daemon with the bridge feature disabled answers every `/_bridge` route as not found, before any token or version check.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
