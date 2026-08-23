The half of the Claude web bridge that lives inside the claude.ai page: it finds the question the cloud session is parked on and hands it to the extension's service worker, mirrors what the session is saying, types the pick the dashboard confirmed into the session's composer and submits it, and draws an on-page panel showing exactly what it did and did not find.

## User story

A `web`-target agent hands its task to a cloud session and ends, so when that session later parks on a question there is nothing streaming back and the question is stranded on claude.ai. The user wants it carried into their local dashboard, wants their pick typed back into the session, and — when any of that fails — wants to be told which step failed rather than facing a bridge that is silently doing nothing.

## Glossary

- **service worker** — the extension's own background half. It holds the daemon token and is the only part that calls the daemon; this half never sees the token and never calls the daemon directly.
- **composer** — the message box on the session's page that text is typed into and sent from.
- **bridge panel** — the small diagnostic box this half draws in the bottom-right corner of the session's page, stating what the bridge found and what happened to it.

## Business logic — TL;DR

- **The session is identified by its page URL** - the cloud session id in the address is the key everything reported from this page is filed under.
- **The parked question is a JSON block on the page** - any object carrying `options` is brace-matched out of the surrounding prose, wherever it renders, including inside shadow roots.
- **The protocol's own examples are not questions** - the page opens with the agent's prompt, which quotes the await protocol verbatim, so anything inside that opening message and anything that looks like the protocol's placeholders or its two literal samples is discarded.
- **The last real block wins** - page order is transcript order, so a later question supersedes an earlier one and the spec that renders above them all.
- **The transcript is mirrored per message** - each message block is reported under its position, and only positions whose text changed are re-sent.
- **When the page has no message blocks, the conversation is mirrored whole** - as one block holding its most recent text, rather than guessing where messages divide.
- **A pick is typed only into a composer that exists** - the composer is waited for, filled, given a beat to settle, then submitted by the page's own send button, or by Enter when there is none.
- **Only the top frame delivers a pick** - a child frame answering too would submit the same text twice.
- **The panel says which step failed** - what was found, where, and what the daemon said, with structure-only counters when nothing was found.
- **It watches the page rather than polling it** - the session's own changes trigger a re-read immediately; a slow heartbeat is only a backstop.

## Business logic

### Identifying the session and reporting its question

#### User story

The dashboard has to show the question against the right agent. The join is the cloud session id, which a `web`-target agent already carries.

#### Business logic

The cloud session id is read out of the page's own address. Nothing is reported from a page that is not a cloud session page.

A found question is handed to the service worker as a title, a list of options with optional detail text, and the recommended option when the block names one. It is trimmed to what the daemon accepts before being sent — title to 500 characters, at most 20 options, each detail to 500 characters, options without a label dropped — and a question left with no title or no options is not reported at all. The worker's verdict is kept for the panel: sent, sent-but-unchanged, the daemon's error, or the fact that the worker never replied.

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

First, position: the transcript's opening message is the agent's own prompt, which quotes the whole await protocol including its worked examples, so no code block rendered inside that first message is ever treated as a question. This applies only when the page marks messages at all; the whole-page fallback has no message boundaries to work with and relies on the second rule alone.

Second, shape. A block is discarded when its title is a lone placeholder in angle brackets; when its title is placeholders joined only by punctuation, leaving no letters once the bracketed groups are removed; when every one of its labels is a placeholder; or when it matches one of the two examples the protocol ships as literal text — the handoff pair "Handled it" / "Could not handle it", and the approval example titled "Ship this?" offering Approve and Decline.

#### Rationale

The placeholder rules exist because the spec block's values are placeholders, and one earlier version faithfully reported `<the question>` to the dashboard. The literal-match rule exists because two of the protocol's examples are written out in full, and no placeholder test can catch text that contains no placeholders. The cost is that an agent asking one of those two sample questions word-for-word is ignored — acceptable, since the protocol tells agents to write a real title.

### Mirroring the transcript

#### User story

The dashboard should show what the cloud session has been saying, not only the moment it stops to ask something.

#### Business logic

Each message the page renders as its own block becomes one transcript entry, numbered by its position on the page, carrying up to 8000 characters of its text. A block that contains an editable field is the composer rather than a message and is left out.

Only entries whose text differs from what was last accepted are sent, and what was sent is remembered only once the daemon has taken it, so a refused batch is retried rather than lost. Position numbering is what makes this work in both directions: a message that is still streaming is re-sent under the same position and replaces its earlier state, while unchanged messages cost nothing.

On every pass this half also reports itself to the daemon — its version, the session it is on, how many message blocks the page has, which container the text came from, and the outcome of the last transcript report.

#### Rationale

The observer fires on every page change and a session's transcript is mostly stable; re-sending all of it each time would be hundreds of kilobytes a second carrying no new information. The self-report exists because diagnosis otherwise required a screenshot of the panel, so every wrong guess cost a round trip through a person.

### Mirroring a page with no message blocks

#### User story

A live session turned out not to mark its messages at all, and a bridge that reports nothing at all in that case is worse than a crude one.

#### Business logic

When the page has no message blocks, the conversation is mirrored as a single entry holding its **most recent** 8000 characters, replaced as it grows. The text is taken from the page's main conversation region when there is one, falling back to the whole document body only as a last resort, with icon-font glyphs removed, blank lines dropped, and the bridge panel itself hidden for the duration of the read. Which container was used is reported, so a layout change surfaces as a container change rather than as mystery text.

#### Rationale

Guessing where one message ends and the next begins would post gibberish that reads like real output, so the honest shape is "here is what is on screen", not "here is how it divides". The text is taken from the end because the page opens with the rendered system prompt: a slice from the front sent 8000 characters of protocol spec and cut off everything the session actually did. Mirroring the whole body sent the sidebar — every navigation label and a run of icon glyphs — which is why the conversation region is preferred, and why the panel hides itself rather than mirroring the mirror.

### Typing the pick into the session

#### User story

The user picks an option in the dashboard and confirms the send. They expect exactly that option to be typed into the session and submitted, and expect to be told what happened either way.

#### Business logic

On being handed a pick, this half waits up to twenty seconds for a composer to appear rather than failing the instant one is absent, then puts the text into it — as the value of a plain text box, or by inserting text into a rich editor, falling back to setting its content directly. After a short pause for the editor's own handling to settle, it submits: by clicking the page's send button when one is enabled — the last such button on the page, since pages render hidden and historical ones above the live composer's — and otherwise by sending an Enter keypress into the composer.

The outcome is reported back precisely: which fill path was used and whether the send was a button click or the Enter fallback, or that no composer ever appeared.

Only the page's top frame accepts a pick.

#### Rationale

This is the one place the extension acts on the user's behalf instead of observing, so it says exactly what it did. The text it can type is bounded twice over: it comes only from the daemon, and the daemon only ever hands back a label belonging to the question the session is currently parked on. The composer wait exists because the first live delivery landed right after a tab was reloaded, and the page takes well over a few seconds to render — "no composer on the page" almost always means "not yet". Only the top frame answers because a child frame answering as well would submit the same text a second time.

### The bridge panel

#### User story

When the question does not reach the dashboard, the user needs to know which step broke — is the extension injected at all, did it find the block, did the daemon refuse it — without opening a developer console.

#### Business logic

A panel is drawn in the page's bottom-right corner showing the extension's version, whether a question was found and in what kind of element, its title and option labels, whether a composer was found, the daemon's verdict on the last question report, the outcome of the last pick delivery, the outcome of the last transcript report, and how many message blocks the page has. The version is on the panel because that is how a stale injected script is told from a current one.

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
