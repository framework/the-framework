The half of the Claude web bridge that lives inside the claude.ai page: it finds the question the cloud session is parked on and hands it to the extension's service worker, mirrors what the session is saying, types the answer the dashboard produced into the session's composer and submits it, and draws an on-page panel showing exactly what it did and did not find.

## User story

A `web`-target agent hands its task to a cloud session and ends, so when that session later parks on a question there is nothing streaming back and the question is stranded on claude.ai. The user wants it carried into their local dashboard, wants their answer typed back into the session, and — when any of that fails — wants to be told which step failed rather than facing a bridge that is silently doing nothing.

## Glossary

- **service worker** — the extension's own background half. It holds the daemon token and is the only part that calls the daemon; this half never sees the token and never calls the daemon directly.
- **composer** — the message box on the session's page that text is typed into and sent from.
- **bridge panel** — the small diagnostic box this half draws in the bottom-right corner of the session's page, stating what the bridge found and what happened to it.

## Business logic — TL;DR

- **The session is identified by its page URL** - the cloud session id in the address is the key everything reported from this page is filed under.
- **The parked question is a JSON block on the page** - any object carrying `options` is brace-matched out of the surrounding prose, wherever it renders, including inside shadow roots.
- **The question travels whole** - not just the title and the labels, but whether several answers may be picked at once, which options start ticked, and which option ends the session instead of continuing it.
- **The protocol's own examples are not questions** - the page opens with the agent's prompt, which quotes the await protocol verbatim, so anything inside that opening message and anything that looks like the protocol's placeholders or its two literal samples is discarded.
- **The last real block wins** - page order is transcript order, so a later question supersedes an earlier one and the spec that renders above them all.
- **The transcript is mirrored one turn at a time** - each conversation turn the page marks is reported under the position the page gives it, as the user's or the session's, and only turns whose text changed are re-sent.
- **A page that marks no turns mirrors nothing** - the panel and the self-report name that state, rather than mirroring whatever text is on screen.
- **An answer is typed only into a composer that exists** - the composer is waited for, filled, given a beat to settle, then submitted by the page's own send button, or by Enter when there is none.
- **Only the top frame delivers an answer** - a child frame answering too would submit the same text twice.
- **The panel says which step failed** - what was found, where, and what the daemon said, with structure-only counters when nothing was found.
- **A session is created through the page's own controls** - the composer's chips (repository, then branch), each opening a searchable list; the page remembers the last repository picked, so the chips are waited for and read rather than assumed; the branch chip must read the requested branch before anything is sent, the session id is read from the address the page becomes, and a failure names the control that was missing.
- **It watches the page rather than polling it** - the session's own changes trigger a re-read immediately; a slow heartbeat is only a backstop.

## Business logic

### Identifying the session and reporting its question

#### User story

The dashboard has to show the question against the right agent. The join is the cloud session id, which a `web`-target agent already carries.

#### Business logic

The cloud session id is read out of the page's own address. Nothing is reported from a page that is not a cloud session page.

A found question is handed to the service worker with the whole shape the session asked it in: a title, a list of options with optional detail text, the recommended option when the block names one, whether several options may be picked at once, which options start ticked, and which options end the session rather than continuing it. It is trimmed to what the daemon accepts before being sent — title to 500 characters, at most 20 options, each detail to 500 characters, options without a label dropped — and a question left with no title or no options is not reported at all. The worker's verdict is kept for the panel: sent, sent-but-unchanged, the daemon's error, or the fact that the worker never replied.

Carrying the shape whole rather than the labels alone is what lets the dashboard render the question as the gate it is — the recommended option marked, several answers tickable at once — and lets an option that ends the session be answered as a hand-over rather than as an instruction to carry on.

#### Rationale

Silence here was the first thing to go wrong in real use: the worker was answering "no token set" and nobody ever saw it, so an extension that looked configured simply did nothing.

### Finding the parked question on the page

#### User story

The agent asks its question in the middle of an ordinary Claude session page — inside whatever markup claude.ai renders that week. The user should not have to do anything for it to be picked up.

#### Business logic

The question is a JSON object carrying `options`, which the agent emits as a fenced code block. It is located by scanning code blocks — including bare `code` elements with no `pre` around them, and including elements inside open shadow roots — and brace-matching every complete object out of the text around it, tracking strings and escapes so a brace inside a label cannot end the object early.

When no code element yields one, the whole page's text is scanned instead, shadow content included, which recovers a block that a syntax highlighter split across elements. Candidates found that way that also appear inside the opening message are subtracted.

Of the surviving candidates, the last in page order is the question, since page order is transcript order: a later question supersedes an earlier, already-answered one.

#### Rationale

Four separate obstacles shaped this, each of which defeated an earlier attempt: the page has `code` blocks with no `pre` wrapper, so a `pre code` scan examined nothing; the message body renders behind shadow roots, so reading the document body's text never saw it; matching on a fixed `{"title"` prefix guessed at an indentation nobody promised; and the page renders the agent's own prompt, so the protocol's spec block is on screen before anything has been asked.

### Telling a real question from the protocol's own examples

#### User story

The user must never see a dashboard card asking them to choose between `<option A>` and `<option B>`, or be asked "Ship this?" by a session that never asked anything.

#### Business logic

Two rules together discard the decoys.

First, position: the transcript's opening turn — the one the page marks as position zero — is the agent's own prompt, which quotes the whole await protocol including its worked examples, so no code block rendered inside that turn is ever treated as a question. The page keeps only the recent part of a long transcript rendered, so the opening turn may be absent; its decoys are then absent with it, and the second rule stands alone.

Second, shape. A block is discarded when its title is a lone placeholder in angle brackets; when its title is placeholders joined only by punctuation, leaving no letters once the bracketed groups are removed; when every one of its labels is a placeholder; or when it matches one of the two examples the protocol ships as literal text — the handoff pair "Handled it" / "Could not handle it", and the approval example titled "Ship this?" offering Approve and Decline.

#### Rationale

The placeholder rules exist because the spec block's values are placeholders, and one earlier version faithfully reported `<the question>` to the dashboard. The literal-match rule exists because two of the protocol's examples are written out in full, and no placeholder test can catch text that contains no placeholders. The cost is that an agent asking one of those two sample questions word-for-word is ignored — acceptable, since the protocol tells agents to write a real title.

### Mirroring the transcript

#### User story

The dashboard should show what the cloud session has been saying — turn by turn, as it is said — not only the moment it stops to ask something.

#### Business logic

The page marks each conversation turn as its own row, stating the turn's position in the transcript and its kind: the user's, the session's, or a marker such as "Resumed session". Each user or session turn becomes one transcript entry under the page's own position, carrying up to 8000 characters from the start of its text, with icon-font glyphs and blank lines removed. Markers are left out.

Only the opening turn — the run's prompt — is ever long enough to be cut. A reply still being written is reported as it grows and replaces its earlier state under the same position.

The page keeps only the recent part of a long transcript rendered. Positions come from the page rather than from counting what is rendered, so the daemon keeps one copy of every turn it has ever been sent, whichever turns are currently on screen.

Only entries whose text differs from what was last accepted are sent, and what was sent is remembered only once the daemon has taken it, so a refused batch is retried rather than lost.

When the page marks no turns at all, nothing is mirrored: the panel's transcript line and the self-report both say that no transcript rows were found.

On every pass this half also reports itself to the daemon — its version, the session it is on, how many turn rows the page has and which kinds they are, how many turns were mirrored, and the outcome of the last transcript report.

#### Rationale

The observer fires on every page change and a session's transcript is mostly stable; re-sending all of it each time would be hundreds of kilobytes a second carrying no new information.

An earlier version, finding no turn markers it recognised, mirrored the whole conversation region as one block of its most recent 8000 characters: the dashboard showed the run's own prompt, the page's navigation labels, and the exchange somewhere at the end with no boundaries. Mirroring nothing and saying so is preferred to that: a layout the mirror does not know is a named state that is fixed by naming the new markers, whereas a wall of page text reads like output and hides that anything is wrong. Reporting the row kinds seen is what makes a new kind show up by name rather than as a missing turn.

### Typing the answer into the session

#### User story

The user answers the question in the dashboard. They expect the session to be told exactly that decision and continued, and expect to be told what happened either way.

#### Business logic

On being handed an answer, this half waits up to twenty seconds for a composer to appear rather than failing the instant one is absent, then puts the text into it — as the value of a plain text box, or by inserting text into a rich editor, falling back to setting its content directly. After a short pause for the editor's own handling to settle, it submits: by clicking the page's send button when one is enabled — the last such button on the page, since pages render hidden and historical ones above the live composer's — and otherwise by sending an Enter keypress into the composer.

The outcome is reported back precisely: which fill path was used and whether the send was a button click or the Enter fallback, or that no composer ever appeared.

Only the page's top frame accepts an answer.

#### Rationale

This is the one place the extension acts on the user's behalf instead of observing, so it says exactly what it did. The text it can type is bounded twice over: it comes only from the daemon, and the daemon composes it out of the options belonging to the question the session is currently parked on — this half neither writes nor edits any of it. The composer wait exists because the first live delivery landed right after a tab was reloaded, and the page takes well over a few seconds to render — "no composer on the page" almost always means "not yet". Only the top frame answers because a child frame answering as well would submit the same text a second time.

### Creating a session

#### User story

The daemon wants a cloud session opened on a given repository and branch with a given prompt, and it must be one that can push: the kind the new-session page's repository picker creates.

#### Business logic

On the new-session page, the composer is waited for, then the chips beside it, which render a beat later: the page remembers the last repository picked, so it may open already showing the requested repository (nothing to pick), another one (that chip is the picker), or none (a bare select-repository control is). When picking, the picker is opened, the full `owner/name` is typed into its search box, and the entry whose text is exactly the repository is clicked — only entries the open list actually shows, since a closed list's entries linger on the page, and never the chip itself — after which the repository chip must read the repository. The branch chip beside it is then read: if it does not already read the requested branch, it is opened and the branch chosen the same way, and the chip is read again; when it still does not read the requested branch, nothing is sent and the outcome says so. The prompt is then typed into the composer and sent by the page's send button, or by Enter when there is none. The outcome is a success only once the page's address names a session, and it carries the session id and a note of what was clicked; every failure names the control that could not be found, and a probe describes the page's controls without touching them so a failed first run is diagnosable.

#### Rationale

A session opened on the wrong branch would push its work somewhere the run never looks, which is why the branch is verified rather than assumed. The session id comes from the address because it is the one thing the page is guaranteed to expose, and it is exactly what the daemon joins runs on.

### The bridge panel

#### User story

When the question does not reach the dashboard, the user needs to know which step broke — is the extension injected at all, did it find the block, did the daemon refuse it — without opening a developer console.

#### Business logic

A panel is drawn in the page's bottom-right corner showing the extension's version, whether a question was found and in what kind of element, its title and option labels, whether a composer was found, the daemon's verdict on the last question report, the outcome of the last answer delivery, the outcome of the last transcript report, and how many turn rows the page has. The version is on the panel because that is how a stale injected script is told from a current one.

When no question was found, the panel adds structure-only counters: how many code and pre elements exist, how many shadow roots, how many frames and how many of them are readable, whether the `options` text exists in the plain page text and whether it exists once shadow content is included, how many object-shaped candidates the scan produced, how many failed to parse and the last parse error, and whether a child frame reported anything. None of this includes message text, so the report is safe to paste into a public issue.

Two buttons: one copies the whole survey as JSON, and one fills the composer with the first option **without** sending it, which proves the write path exists without the extension ever speaking for the user.

The panel folds down to a compact "TF" tab and back. Folding is remembered across reloads in the extension's own storage rather than the page's, so nothing the extension keeps is readable by the page it watches; while folded the title and version retreat into the tab's tooltip. Folding hides the detail, not the bridge — the page keeps being surveyed and the daemon keeps hearing from it.

#### Rationale

The counters distinguishing "never found the block" from "found it and could not read it" exist because those two failures look identical from the dashboard, and each has a completely different fix.

### Frames

#### User story

Whether the session's content renders in the page itself or inside a frame is exactly the kind of question that costs a debugging session to answer.

#### Business logic

This half runs in child frames too, but a child frame draws no panel. Instead, a child frame that finds a question — or that merely sees JSON-shaped blocks or the `options` text — posts its survey up to the top frame, which shows that finding and marks it as coming from a frame. A child frame's find takes precedence in the panel, because the fact that the content lives in the frame is itself the answer.

### Watching the page rather than polling it

#### User story

The bridge is meant to work in a pinned background tab nobody is looking at.

#### Business logic

Every re-read is triggered by the page's own changes, coalesced so a burst of changes causes one pass, plus a slow heartbeat once a minute as a backstop for a change that was missed. When the extension is reloaded out from under an already-injected script, that script stops watching entirely instead of continuing to fail.

#### Rationale

A frequent timer is the wrong instrument here: the browser slows timers in a tab hidden for more than a few minutes to roughly once a minute, while the session's stream mutates the page the moment anything happens, so watching catches it immediately. And an orphaned script left running after an extension reload throws on every attempt to reach the extension; those throws surface as extension errors and read as product bugs, so a script whose extension is gone shuts itself down.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
