Runs in every claude.ai page as the extension's content script [1]: it finds the question block [2] a cloud session [3] is parked on and hands it to the worker [4], mirrors the session's transcript, and draws a diagnostic corner panel [5]; in the Driver tab [6] it also reads claude.ai's session list, visits sessions inside the app, types the answers [7] the worker hands it, creates a cloud session through claude.ai's repository, branch and model pickers, and covers the page with an overlay [8]. It holds no secret and never talks to the daemon itself.

## Context

**User story**:
- A hands-off [9] agent's [10] cloud session [3] stops at a gate [11]; the user sees the question in the dashboard, as the same card a local agent's gate gets, with the same options, defaults and recommendation.
- The user answers in the dashboard; the answer [7] is typed into the session and submitted, and the dashboard reports it as sent, or as failed with why.
- The user reads the session's transcript in the dashboard while the session works.
- The user starts a hands-off agent and its cloud session appears on claude.ai, bound to the project's repository, on the agent's branch, on the model the user chose.
- The user sets the bridge up with the bridge browser [12] and signs in to claude.ai once in its window, on the very tab the extension drives.

**Problem**:
- claude.ai's page is not ours. Message bodies sit behind shadow roots, code blocks come without their usual wrapper, a syntax highlighter splits a block across elements, and the page renders the agent's own prompt, which quotes the whole gate protocol with its examples, so a spec or an example looks exactly like a question. Every selector is a guess about someone else's user interface, so the script reports what it found and names the control it could not find rather than guessing.
- The content script [1] shares the tab with claude.ai: it must never hold the bridge token [13], and a request from the page would carry the page's origin into a CORS check the daemon refuses on purpose. Everything goes through the worker [4].
- The script is meant to run in a background tab, where Chrome slows timers to about once a minute after five minutes hidden. The page's own changes are the trigger, not a clock.

## Glossary

[1] content script: the script the extension injects into every claude.ai page; it shares the page with claude.ai and holds nothing secret.
[2] question block: the JSON object with a `title` and `options` that an agent writes into its final message when it stops at a gate; claude.ai renders it as a code block in the session's transcript.
[3] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[4] worker: the extension's background service worker: the half of the extension that holds the bridge token and talks to the daemon; Chrome runs it without any page and ends it when idle.
[5] corner panel: the diagnostic box the content script draws in the bottom-right corner of every claude.ai page that is not the Driver tab, titled "The Framework bridge v<version>".
[6] Driver tab: the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[7] answer: the text the daemon composes from a pick for the extension to type into the cloud session; it is queued in the dashboard until a Driver tab collects it, then marked sent or failed as the extension reports.
[8] overlay: the full-page cover the content script draws over the Driver tab, titled "The Framework Driver".
[9] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[10] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[11] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[12] bridge browser: the Chrome for Testing the daemon runs for it.
[13] bridge token: the secret the extension presents.
[14] survey: one read of a claude.ai page by the content script: it looks for the question block, mirrors the transcript and redraws what it shows.
[15] the built-in system prompt: the standing instructions every agent starts with (`prompts/system_prompt.md`).
[16] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[17] transcript mirror: the copy of a cloud session's transcript the content script sends to the daemon, one entry per conversation turn keyed by the turn's position.
[18] session request: the daemon's request that the extension create a cloud session on claude.ai for a hands-off agent: a repository, a branch, a prompt and optionally a model; queued on the daemon, claimed by the worker that reads it, and reported back as created or failed.
[19] list status: what claude.ai's own session list says a session is doing, as the Driver tab reads it off the status icon beside the session's row: `awaiting`, `unread`, `idle`, `running`, `landed`, `missing` or `unknown`.
[20] cycle: one pass of the worker's loop, twice a minute: list the sessions to serve, read their list statuses, visit what is due, account for every answer and session request.

## Business logic — TL;DR

- **Nothing secret, nothing direct** - the script runs on every claude.ai page and frame, never holds the token, never calls the daemon, exposes nothing to the page, keeps its one preference in extension storage, and stops quietly once its extension has been reloaded from under it.
- **Finding the question block** - every code block outside the opening message is read, shadow roots included, with the whole page's text as a fallback; every JSON object with `options` is brace-matched out of the surrounding prose, and the last real one wins.
- **The protocol's own examples are not questions** - a block whose title or labels are placeholders, or that is one of the protocol's two literal examples, is documentation, not the session asking.
- **An answered question is not pending** - a block followed by a human turn was answered, however long it stays on the page.
- **What is reported** - the session id, a title, up to twenty options with their detail and `default` and `stop` flags, the recommendation and `multi`, capped, and only when there is a title and an option; the worker's word on the report is shown on the panel.
- **Mirroring the transcript** - one entry per conversation turn, keyed by the page's own position, human and assistant turns only, cut at 8000 characters, and only what changed since the daemon last took it.
- **Watching the page, not polling it** - a survey runs on load, a quarter second after any change to the page, and once a minute as a backstop; the script's own drawing never counts as a change.
- **Typing an answer into the composer** - the composer is waited for, filled, and submitted through the send button or, failing that, Enter; the report says which; no composer means an honest failure.
- **Creating a session on the new-session page** - the repository chip, the branch chip and the model picker are read before they are touched and verified afterwards; nothing is sent unless all three read right; the session id is read from the address; every failure names what was missing or what the page offered instead.
- **The Driver tab reads the session list** - each watched session's row yields a list status from the label on its status icon, or from its pull request's state, paging the list through its own "Show N more" button; a session not shown is `missing`; a page without rows is named, not read as every session missing.
- **The Driver tab's drive** - the session request first, then each visit inside the app: open the session, survey it, type the answer, count it as taken only once the composer is empty and the transcript grew, and end back on the list; one instruction at a time.
- **The overlay** - the Driver tab is covered with "The Framework Driver", a status line and the cycle log; it comes back whenever removed, stands aside on the sign-in pages, and replaces the corner panel there.
- **The corner panel** - every other claude.ai page shows what the last survey found, the worker's status, the last delivery and the transcript's state, diagnostics when no question was found, a "Copy report" button, a "Fill composer (does not send)" button, and a fold to a "TF" tab.
- **Frames** - a child frame draws nothing and reports its findings to the top frame, whose panel says the question was found "in iframe"; only the top frame is ever driven.

## Business logic

### Nothing secret, nothing direct

#### Context

See `## Context`.

#### Business logic

The content script [1] runs on every `https://claude.ai/*` page, in the top frame and in every child frame, once the page is idle. It never holds the bridge token [13] and never calls the daemon: a found question, a transcript batch, a hello and a cycle log line are each handed to the worker [4] by message, and the worker's reply is what the corner panel [5] shows as the bridge's status. Nothing is added to the page's window while the extension runtime exists; the entry points the offline harness (`check.mjs`) drives exist only when there is no extension runtime. The one preference the script remembers, the corner panel's fold, is kept in extension storage, never in the page's own storage, so nothing the extension keeps is readable by the page it watches. A script whose extension was reloaded from under it (every call to the extension then throws) stops watching the page instead of erroring once a minute forever; reloading the tab is the fix.

### Finding the question block

#### Context

**Business logic story**: an agent [10] that stops at a gate [11] writes, in its final message, a JSON object with a title and options, as the protocol in the built-in system prompt [15] states; on claude.ai it renders as a code block somewhere in the session's transcript, with prose around it.

#### Business logic

The candidates are every code element on the page (`pre code`, `pre` and bare `code`), including those inside open shadow roots, except the ones inside the opening message: the transcript row at position 0, which is the agent's own prompt and quotes the whole protocol, examples included, so nothing in it is ever the session asking. When no element yields a block, the fallback is the whole page's text, shadow content included, minus every block that also appears in the opening message. In any text, every JSON object that contains `"options"` is brace-matched out of the surrounding prose, tracking strings and escapes so a brace inside a label cannot close the object early and assuming no indentation; each is parsed, and only an object whose `options` is a list counts. Blocks are collected in page order, which tracks transcript order. After the protocol's examples and the answered questions are removed, the last block wins: the spec comes before the question, and a later question outranks an earlier one. A block still streaming does not parse yet and is simply not a candidate until the next survey [14].

### The protocol's own examples are not questions

#### Context

**Problem**: the page renders the agent's [10] prompt, so the protocol's spec, whose title is `<the question>` and whose option is `<option>`, and its two literal examples show up as blocks with `options` before the agent has asked anything. Skipping the opening message catches them, but a long transcript keeps only its tail on the page, so once the opening message has scrolled out of it the decoys must be recognized by their shape.

#### Business logic

A block is one of the protocol's own and never a question when: its title is a single `<placeholder>`; or its title is placeholders joined by punctuation only, with no letter left once every `<…>` group is removed (a real title that mentions `<SESSION_NAME>` keeps its other words and stands); or every option label is a placeholder; or its option labels are exactly "Handled it" and "Could not handle it"; or its title is "Ship this?" with the labels exactly "Approve" and "Decline". The last two are matched verbatim, so an agent asking the documentation's sample question word for word loses, by design: it was told to put a real title there.

### An answered question is not pending

#### Context

**Problem**: the answered block stays on the page after the user's answer [7], and the daemon forgets what was answered when it restarts; re-reporting it would type a second answer into a session that moved on.

#### Business logic

A block is answered when a human turn sits at a later position than the transcript row holding the block; the row is found through shadow roots too. A block placed in no row is measured against the session's latest assistant turn instead. With no positioned turns at all there is nothing to measure against, and the block stands. An answered question is not reported, and the corner panel [5] shows "question found no (already answered)". A question asked again after that answer is pending again, as the last block always is.

### What is reported

#### Context

**Business logic story**: the dashboard renders a bridged question through the same card a local gate [11] gets, so the block's own shape has to reach the daemon whole: `multi` for a multi-select, per option a `default` that starts checked and a `stop` whose pick [16] hands the session back to the user instead of continuing it (`bridge-store.ts`).

#### Business logic

The report names the session by the id in the page's address (`/code/session_…`); a page without one reports nothing. It carries the title cut to 500 characters; the options, each with its label, its detail cut to 500 characters, and its `default` and `stop` flags when set, with label-less options dropped and at most twenty kept; the recommended label; and `multi`. Nothing is sent without a title or without at least one option. The worker's [4] word on the report is the corner panel's [5] "bridge" row: "sent", "sent (unchanged)" for a repeat the worker did not post, "no token set: open the extension options", the daemon's refusal, "no reply from the worker", or "worker unreachable"; it starts at "not sent yet".

### Mirroring the transcript

#### Context

**User story**: the user reads in the dashboard what the cloud session [3] has said so far, while it works and while it is parked.

#### Business logic

claude.ai renders the conversation as transcript rows, each naming its position and its kind. The transcript mirror [17] takes one entry per row: a human row as the user's turn, an assistant row as the agent's, and leaves every other kind (markers such as "Resumed session") out. A turn's text is cleaned of icon glyphs and blank lines and cut to 8000 characters from its start; only the opening turn, the agent's [10] prompt, is ever that long. The position is the key: the page keeps only the tail of a long transcript rendered, so the daemon keeps one copy per position whichever rows happen to be on the page, and a reply still streaming is sent again as it grows and replaces the earlier copy. Only entries whose text changed since the daemon last accepted them are sent, remembered per session and position because the Driver tab [6] moves between sessions inside one page; a batch the daemon refused is retried on the next change. A page with no transcript rows mirrors nothing and says "no transcript rows found": a layout the mirror does not know is named rather than mirrored as whatever text is on screen. Every read also sends a hello with the version running in the page, the session id, and a note such as "rows 12 (human,assistant), turns 11, sent 2 of 11 turn(s)" or "rows 0, no transcript rows found", so the daemon can say which script is injected and what it last saw without anyone screenshotting the panel. The panel's "transcript" row shows "not sent yet", "<n> turn(s), unchanged", "sent <x> of <n> turn(s)", the daemon's refusal, "failed", or "worker unreachable".

### Watching the page, not polling it

#### Context

See `## Context`.

#### Business logic

A survey [14] is one read of the page: find the question block [2] and report it, mirror the transcript, and redraw what the script shows. It runs when the page loads, a quarter of a second after any change to the page (changes within that window are folded into one survey), and at least once a minute as a backstop for a change the script failed to see. The script's own drawing, the corner panel [5] and the overlay [8], pauses the watching, so a redraw is never taken for a page change: one page change costs exactly one survey, and a page where nothing changes costs none.

### Typing an answer into the composer

#### Context

**User story**: the user picks [16] an option in the dashboard; the answer [7] is typed into the session's composer and submitted.

**Business logic story**: this is the one place the extension acts rather than observes. The text it types comes only from the daemon, which composes it from labels the session itself offered, so what can be typed here is bounded by what the session asked.

#### Business logic

The composer is the first editable text area on the page, else the first plain text box, shadow roots included; it is waited for up to 20 seconds, because claude.ai takes well over five seconds to render after a tab revive, so "no composer" mostly means "not yet". Without one the delivery fails with "no composer on the page". A text box is filled by setting its value; an editable area by inserting the text as typing, or, when the page ignores that, by setting its text outright. After a short pause for the editor to settle, the last enabled button whose accessible label mentions "send" is clicked (the last one, because pages render hidden or historical buttons above the live composer's), or failing that the last submit button; with neither, Enter is pressed in the composer. The report says which path was taken: "filled contenteditable, clicked send button", "filled textarea, no send button, sent Enter", and so on; the corner panel's [5] "answer" row shows "sent via <composer> + button", "sent via <composer> + enter" or "failed: no composer on the page", and starts at "none delivered". Whether the page actually took the send is judged by the Driver tab's [6] visit, below.

### Creating a session on the new-session page

#### Context

**Business logic story**: a session created through claude.ai's repository picker is bound to that repository, and only such a session can push and open a pull request, which is what a hands-off [9] agent's [10] work needs. So the daemon queues a session request [18] (`bridge-starts.ts`) and the Driver tab [6] drives the same controls a person would on the new-session page: the repository chip and its searchable list, the branch chip that appears beside it, the model menu, the composer, send.

**Problem**: the page remembers the last repository and the last model picked, so it may open showing ours, another one, or none. A session opened on the wrong branch would push its work somewhere the agent never looks, and a session on the page's default model is the user's choice silently dropped. So every control is read before it is touched and verified afterwards, and nothing is sent unless all of them read right.

#### Business logic

- The composer is waited for up to 20 seconds; without one the creation fails with "no composer on the new-session page". The chips render a beat after it: the script waits up to 6 seconds for a chip or for a bare "Select repo", "Add repo" or "Choose repo" control, then lets the page settle.
- Repository. The chips are the visible combobox buttons in the page's order: the repository, then the branch, then "add another repository". If the first chip already reads the requested repository, as `owner/name` or as the bare name, case-insensitively, the note says "repo already <name>". Otherwise the picker is that chip when it reads another repository, or the bare control when nothing is remembered; with neither, the creation fails with "no repo picker on the page" and a description of what the page offers. Picking opens the picker, waits up to 1.5 seconds for its search box and up to 6 seconds for its visible entries (a closed picker's entries stay in the page but are not on offer), and clicks the first visible entry reading exactly the full name, else the bare name. When none matches and there is a search box, the full name is typed into it and the list watched for 3 seconds; still nothing, the search is cleared and the whole list scanned for 3 more seconds. With no match the picker is closed with Escape and the creation fails with "repo: the list offered no "<name>"" plus what was visible: the search box's placeholder, how many entries were visible of how many exist, the first five, and the chips. After a failed pick the chip is read once more 1.5 seconds later, in case the page finished loading its remembered repository under the script. After a pick the repository chip must read the name within 6 seconds, else the creation fails with "…, but the repo chip does not read "<repository>" afterwards". Nothing inside the picker's own trigger is ever clicked as an entry, and the icon glyphs the page puts beside labels are ignored when reading them.
- Branch. The branch chip must appear beside the repository chip within 6 seconds, reading the repository's default branch; else "no branch chip appeared beside the repo". If it reads the requested branch the note says "branch already <branch>"; otherwise the branch is picked from it the same way ("branch: …"), and the chip must read it within 6 seconds, else "…, but the branch chip does not read "<branch>" — not sending".
- Model, only when the session request names one. The picker is the menu button beside the composer reading a model name (a label containing fable, opus, sonnet or haiku), waited for up to 6 seconds; a page without one fails with "no model picker on the page — not sending". A label reads the wanted model when it equals it or contains it as a whole word: `opus` reads "Opus 5", `Opus 4.8` reads only "Opus 4.8". If the picker already reads it, "model already <label>". Otherwise the menu is opened and its entries waited for up to 6 seconds; entries are read without the hidden shortcut digit and check glyph beside them, so "Sonnet 5" is read, not "Sonnet 53". The entry reading the exact label is clicked, else the first entry carrying the model's word, which is the newest version since the menu lists current versions first. When the menu offers nothing, its "More models" item is opened, the submenu of older versions is waited for, and the search repeats there. With no match the menu is closed with Escape and the creation fails with "model: the menu offered no "<model>"" plus the entries seen. After a pick the picker must read the model within 6 seconds, else "…, but the model picker does not read "<model>" afterwards — not sending".
- Send. The prompt is typed into the composer; after a short pause the send button is clicked, or Enter pressed when there is none. The page must then become a session address within 60 seconds; the session id read from it is the result, with a note joining the repository, branch and model notes and "sent via button" or "sent via enter". A page that never becomes a session fails with "sent, but the page never became a session URL" and the same notes: a send that produced no session is a failure with a reason, never a silent success.
- The probe describes the page without touching it, text only and capped: the address, the composer's kind, whether a send button exists, what the model picker reads, the chips' text, and up to forty controls, so a failed first run says what the page offers and is safe to paste into an issue.

### The Driver tab reads the session list

#### Context

**Problem**: the extension cannot know an agent [10] started or stopped; claude.ai's own session list can. The status icon beside each session row carries a text label, and that label is the only signal for a session that asked its question in prose.

#### Business logic

The session list's rows are the links on claude.ai's `/code` page whose address names a session; the session id is read from the link. A row's list status [19] comes from the labels on it, ignoring the "More options" label: "Awaiting input" is `awaiting`, "Unread response" is `unread`, "Idle" is `idle`, "Running" is `running`, and the first such label on the row wins. Only with no status word on the row does its pull request stand in for one: a label reading "#<number> · Merged" or "#<number> · Closed" is `landed`, the session's work having landed; any other pull request state ("#<number> · Open", "#<number> · Draft") is `idle`, a session that went quiet; a row with "Awaiting input" beside a pull request is still `awaiting`. Any other label is `unknown` and carried with its first label, cut to 80 characters, so it can be named rather than guessed at. A link to a session elsewhere on the page is not its row: the first link wins unless a later one carries a status and the first did not. The read waits up to 20 seconds for any row at all; a page with none is not a list (signed out, or not on the sessions page) and is refused with "no session rows on <path>" rather than read as every session missing. While a wanted session is not shown, the list's own "Show N more" button is clicked, up to ten times, each click given 5 seconds to grow the list, stopping when a click adds nothing; the button counts as the list's only when session rows sit within three levels above it, so the middle panel's own "Show N more" is never taken for it. A session still not shown is `missing`. Only the top frame takes instructions, and one at a time: a list read or a drive asked while another runs in the page is refused as busy, because two drives would navigate over each other; this happens when the worker [4] that sent the first ended mid-cycle [20] while the page drives on.

### The Driver tab's drive

#### Context

**User story**: within about a minute of an agent [10] stopping, its question shows in the dashboard; within about a minute of the user answering, the answer [7] is in the session; the Driver tab [6] stays a pinned background tab the user never has to look at.

#### Business logic

A drive does the session request [18] first, when there is one, because an agent is waiting on it and the new-session page is where a cycle [20] starts, then the visits, then goes home. Home is claude.ai's `/code` page, reached through the app's own "New" link, never by a page load, and given 15 seconds plus a moment to settle; when home cannot be reached the creation fails with "could not reach the new-session page". A visit opens the session by clicking its row on the list; a session not on the list fails with "not on the list", its answer untouched. The address must become the session's within 15 seconds ("the page did not become <id>" otherwise); then the script waits up to 20 seconds for transcript rows that are not the previous session's, since the address changes before the page does, and lets the page settle. The session is then surveyed like any page: its question and its transcript reach the daemon, and the visit's result carries its row count and the question's title. With an answer to deliver, the text is typed and submitted as described above, and counted as taken only once, within 15 seconds, the composer is empty again and a transcript row exists that did not before (a new row, not a higher count, because a long transcript keeps only its tail rendered); otherwise the delivery is reported failed with "…, but the page did not take the send: composer still holds text" or "composer empty", and the row counts before and after. The transcript is mirrored again after a delivery. The drive ends back on the list; when it cannot get there it says so ("could not get back to the session list"). Every step writes a line to the cycle log, "cycle: one session to create, 2 visit(s)", "create: <session id or note>", "visit <id> (awaiting)", "  <id>: 12 rows, question "…", answer sent", which the overlay [8] shows and which is also sent to the worker [4], keeping it awake for as long as lines keep coming.

### The overlay

#### Context

**User story**: the Driver tab [6] is not for people. The user sees "The Framework Driver" on it, understands what it is doing, and uses another tab for claude.ai; when the bridge browser [12] needs a sign-in, the user signs in on that very tab.

#### Business logic

The overlay [8] covers the whole Driver tab: the heading "The Framework Driver", the sentence "The Framework is using this tab to watch your Claude Code sessions and to type your answers into them. Use another tab for claude.ai. Closing this tab pauses the bridge; the extension's options page reopens it.", a status line "bridge v<version> · <path> · <n> turn rows · question <bridge status> · transcript <transcript status>", and "Show debug logs", which unfolds the last 300 lines of the cycle log. A tab becomes the Driver tab when the worker's [4] reply to the page's hello says so, the moment the page loads, or when the first instruction arrives. The overlay is placed beside the app's root rather than inside it, so an in-app navigation leaves it alone, and it is put back on the next page change whenever anything removes it. It stands aside on claude.ai's sign-in pages (`/login` and `/logout`), the one place a person has to act in this tab, and comes back with the next page. Typing goes through the composer's own value and the send button's click, never through the pointer, so covering the composer costs nothing. The corner panel [5] is hidden in the Driver tab, but surveys [14] still run there, so the sessions it visits are read and mirrored like any other page's.

### The corner panel

#### Context

**User story**: the user opens a session on claude.ai in their own tab and sees at a glance whether the bridge found the question, whether the daemon took it, and, when not, enough about the page to report it.

#### Business logic

Every claude.ai page that is not the Driver tab [6] carries a small box in its bottom-right corner titled "The Framework bridge v<version>"; the version is how a stale script is told from a current one. Its rows are "question found" ("yes (<pre|code|page-text>)", with ", in iframe" when a child frame found it, or "no", with " (already answered)" when that is why), "title", "options" (the labels joined by " | "), "composer" ("contenteditable", "textarea" or "not found"), "bridge" (the worker's [4] word on the last report), "answer" (the last delivery's outcome), "transcript" (the mirror's state) and "turn rows". When no question was found, diagnostics follow, structure and lengths only, never message text, so the report is safe to paste into a public issue: the counts of `code` and `pre` elements, shadow roots, and iframes with how many are reachable, whether the word `"options"` occurs in the page's plain text and in its text with shadow content, how many JSON candidates the brace matcher saw and how many failed to parse, the last parse error, and whether a child frame reported. "Copy report" puts the latest survey [14], as JSON, on the clipboard. "Fill composer (does not send)" types the first option, or "test", into the composer without submitting: it proves the write path exists without the extension ever speaking for the user. The "−" button folds the panel down to a compact "TF" tab whose tooltip carries the full title, and "+" unfolds it; the fold is remembered in extension storage across reloads, and folded or not, surveys keep running and the daemon keeps hearing from the page.

### Frames

#### Context

**Problem**: a session's content may live in a frame; the top frame's report has to say whether it did, and a child frame acting on a drive would click and submit twice.

#### Business logic

A child frame draws no panel and takes no instruction. It surveys [14] its own document and, only when it found a question or saw JSON-shaped blocks or the word `"options"` in its text, sends its findings to the top frame. The top frame's corner panel [5] shows a child frame's find as the winner when it found nothing itself, marked ", in iframe", and its "frame reported" diagnostic says whether any frame spoke. Only the top frame reads the session list and drives: the list and the composer live there.
