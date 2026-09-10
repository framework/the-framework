The Chrome extension half of the Claude web bridge [1]. It keeps one pinned claude.ai tab, the Driver tab [2], that reads claude.ai's own session list, visits the cloud sessions [3] of hands-off [4] agents [5] that stopped for their user, reports the gate [6] each one is parked on to the daemon so the dashboard shows it as a card, types the user's pick [7] back into the session, mirrors each session's transcript, and creates a new cloud session through claude.ai's repository picker when the daemon asks for one; a worker [8] that holds the bridge token [9] carries everything between the pages and the daemon. The daemon's end of the bridge lives in `packages/framework/src/dashboard/bridge-endpoints.ts` and the `bridge-*.ts` files beside it, and the Chrome the daemon can run for the extension, the bridge browser [10], in `packages/framework/src/bridge-browser.ts`. `manifest.json` declares what the extension may touch and is described below; `options.html` is the markup of the extension's options page, whose logic is `options.js`; `README.md` and the `*.BUG-ANALYSIS.md` files are documentation and carry no business logic.

## Context

**User story**:
- The user starts a hands-off [4] agent [5] from the dashboard. Its work runs in a cloud session [3] on claude.ai, so when the session stops to ask something, nothing streams back to this machine. The user still finds the question in the dashboard, as the same card a local agent's gate [6] gets, multi-select included, answers it there, and the answer is typed into the session. The dashboard shows whether the answer was sent, and a queued answer can be withdrawn until the extension collects it.
- The daemon needs the cloud session created through claude.ai's own repository picker, on the branch the agent pushed and on the model the user chose: only a session bound to a repository can push and open a pull request. The user sees the session link in the dashboard within about a minute of starting the agent.
- The user sets the bridge up once. The bridge is switched on in the dashboard's Settings, which mints the bridge token [9]. Then either the bridge browser [10] is switched on too, in which case the daemon installs this extension into its own Chrome for Testing, hands it the token, and the user signs in to claude.ai in that window once; or the user loads the extension unpacked into their own Chrome, grants it site access, and pastes the token into its options page.
- The user reads a session's transcript in the dashboard, and sees that a session is still waiting on them even when it asked in prose rather than with options.

**Problem**:
- The extension only sees pages it is injected into, so it cannot know an agent started. The daemon publishes which cloud sessions are its, and the one Driver tab [2] serves them all by reading claude.ai's session list and visiting only what needs it: fifty sessions cost one tab and a handful of clicks, not a tab each.
- claude.ai's page must never be able to read the secret that talks to a daemon that spawns processes. The token lives in the worker [8] and in extension storage only, and nothing on a page can call the daemon.

## Glossary

[1] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[2] Driver tab: the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[3] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[4] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[6] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[7] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[8] worker: the extension's background service worker: the half of the extension that holds the bridge token and talks to the daemon; Chrome runs it without any page and ends it when idle.
[9] bridge token: the secret the extension presents.
[10] bridge browser: the Chrome for Testing the daemon runs for it.
[11] content script: the script the extension injects into every claude.ai page; it shares the page with claude.ai and holds nothing secret.
[12] question block: the JSON object with a `title` and `options` that an agent writes into its final message when it stops at a gate; claude.ai renders it as a code block in the session's transcript.
[13] answer: the text the daemon composes from a pick for the extension to type into the cloud session: "You paused to ask: "<question>". The user chose: <labels>. Continue with that decision.", or, when the pick stops the session, the same sentence ending in "Stop here: the user is taking over and will come back with fresh instructions."; it is queued in the dashboard until a Driver tab collects it, then marked sent or failed as the extension reports.
[14] session request: the daemon's request that the extension create a cloud session on claude.ai for a hands-off agent: a repository, a branch, a prompt and optionally a model; queued on the daemon, claimed by the worker that reads it, and reported back as created or failed.
[15] cycle: one pass of the worker's loop, twice a minute: list the sessions to serve, read their list statuses, visit what is due, account for every answer and session request.
[16] list status: what claude.ai's own session list says a session is doing, as the Driver tab reads it off the status icon beside the session's row: `awaiting`, `unread`, `idle`, `running`, `landed`, `missing` or `unknown`.
[17] survey: one read of a claude.ai page by the content script: it looks for the question block, mirrors the transcript and redraws what it shows.
[18] transcript mirror: the copy of a cloud session's transcript the content script sends to the daemon, one entry per conversation turn keyed by the turn's position.
[19] corner panel: the diagnostic box the content script draws in the bottom-right corner of every claude.ai page that is not the Driver tab, titled "The Framework bridge v<version>".
[20] overlay: the full-page cover the content script draws over the Driver tab, titled "The Framework Driver".

## Business logic — TL;DR

- **A question's way into the dashboard** - the content script surveys every claude.ai page it runs in, and a question block it has not reported yet travels to the daemon, which shows it as the same card a local agent's gate gets.
- **An answer's way back** - the daemon holds the user's pick as a queued answer until a Driver tab collects it, types it into the session and confirms it went in; until then it can be withdrawn.
- **Creating a cloud session for a hands-off agent** - each cycle the worker claims the daemon's oldest session request, drives claude.ai's own repository picker and model menu, and reports the session it created or why it could not.
- **The token never reaches the page** - the bridge token and the dashboard address live in extension storage that no web page can read, and only the worker ever calls the daemon.
- **Version lockstep with the daemon** - every call states the extension's version and a daemon expecting another refuses it outright, so a half-updated pair fails loudly rather than misbehaving quietly.
- **What the manifest grants** (`manifest.json`) - the content script [11] runs on every `https://claude.ai/*` page and frame; host permissions cover `http://localhost/*` and `http://127.0.0.1/*` only, the daemon's address; the extension asks for extension storage, tabs and alarms and nothing else, and states version `0.12.0`, which the daemon insists on.
- **Setup and the connection test** (`options.js`) - the options page keeps the dashboard address, the bridge token [9] and the "Run the Driver tab" switch in extension storage, proves the connection with "Save and test", telling a missing site grant, a bridge that is off, a wrong token, a version mismatch and a dashboard without the bridge apart, shows what the last cycle [15] did, and reopens a closed Driver tab [2] on demand.
- **The worker's cycle** (`background.js`) - every half minute the worker [8] asks the daemon which sessions to serve and collects their queued answers [13], claims the next session request [14], keeps one Driver tab, has it read the session list and visit what is due (answers first, four visits per cycle), and accounts to the daemon for every answer and session request; closing the Driver tab pauses the bridge; the worker reloads the extension when its files change on disk.
- **Which sessions a cycle visits** (`driver-plan.js`) - a session is visited when its list status [16] changed to `awaiting`, `unread` or `idle`, when it has stayed `awaiting` for five minutes without a visit, and always when an answer is queued for it.
- **The content script** (`content.js`) - on every claude.ai page it finds the question block [12], discards the protocol's own examples and answered questions, reports the question and the transcript mirror [18] through the worker, and draws the corner panel [19]; in the Driver tab it reads the session list, visits sessions inside the app, types answers and confirms the page took them, creates a session through the repository, branch and model pickers, and draws the overlay [20].
- **Knowing when its own files changed** (`fingerprint.js`) - a hash of each of the extension's seven files, compared at every wake of the worker, where a file that cannot be read never counts as a change.
- **The offline tests** (`check.mjs`) - the extraction, the reported shape, the transcript mirror, the answer delivery, the corner panel's fold, session creation, the Driver tab, the visit planner and the fingerprint, proven against synthetic pages without a browser.

## Business logic

### A question's way into the dashboard

#### Context

**User story**: a cloud session [3] stops at a gate [6]; the user sees the question in the dashboard within about a minute, as the card a local agent's gate gets.

#### Business logic

The content script [11] surveys every claude.ai page it runs in: on load, after every change to the page, and at least once a minute. When a survey [17] finds a question block [12] that is neither one of the protocol's own examples nor already answered, it hands the question to the worker [8]: the session id, the title, up to twenty options with their detail, `default` and `stop` flags, the recommended option, and whether several may be picked. The worker posts it to the daemon with the bridge token [9], once per distinct question per session. The daemon keeps it as the session's parked question and the dashboard renders it (`bridge-store.ts`). The Driver tab [2] is what brings a page to the question: each cycle [15] it reads claude.ai's session list, and a session whose list status [16] turned `awaiting` is visited, surveyed like any page, and left again. The list statuses themselves are posted to the daemon, which is how the dashboard knows a session is waiting on the user even when it asked in prose and there is no block to report.

### An answer's way back

#### Context

**User story**: the user picks [7] an option in the dashboard's card; the pick is typed into the cloud session [3] and submitted, and the card shows the answer [13] as sent, or as failed with the reason.

#### Business logic

The daemon turns the pick [7] into an answer [13] and holds it queued, flagging the session in the list it publishes to the worker [8] (`bridge-store.ts`; a queued answer can be withdrawn until a Driver tab collects it). In its next cycle [15] the worker collects the answer. The daemon hands each answer to one asker at a time, so the user's own Chrome and the bridge browser [10] never both type it. The visit planner then schedules the session whatever its list status [16]. The Driver tab [2] opens the session inside the app, types the answer into the composer, submits it, and counts it as taken only once the composer is empty again and the transcript gained a turn. The worker acknowledges the outcome to the daemon as the page reported it. An answer the visit never reached stays queued and is tried again next cycle; a page torn down mid-drive is acknowledged as failed with a warning to check the session before picking again; an acknowledgment the daemon did not take is retried on every later cycle. The daemon marks the answer sent or failed, and a sent answer resolves the parked question.

### Creating a cloud session for a hands-off agent

#### Context

**Business logic story**: a hands-off [4] agent's [5] cloud session [3] must be bound to the project's repository, which only claude.ai's own repository picker does. So the daemon does not create the session itself: it queues a session request [14] for the extension (`bridge-starts.ts`) and waits for the session id.

#### Business logic

Each cycle [15] the worker [8] claims the daemon's oldest session request [14] by reading it; from then on the request is the worker's to report on. Before any visit, the Driver tab [2] goes to claude.ai's new-session page, makes the repository chip read the requested repository, the branch chip the requested branch and, when the request names one, the model picker the requested model, reading each before touching it and verifying each afterwards, then types the prompt, sends, and waits for the page to become a session. The worker reports the session id, or a failure whose note names the control that was missing or the value that did not take. A Driver tab that is switched off or paused fails the request at once with that reason, so the agent is told rather than left waiting; a Driver tab still busy with an earlier drive leaves the claim alone, and the daemon offers the request again once the claim expires.

### The token never reaches the page

#### Context

**Problem**: the bridge is attached to a daemon that spawns processes, and the bridge's endpoints are the daemon's only routes meant to be reached from another origin. A stolen token must buy as little as possible, and no site the user visits may be able to post to their dashboard.

#### Business logic

The bridge token [9] and the dashboard address live in extension storage, which no web page can read; only the worker [8] reads them, and only the worker calls the daemon, presenting the token on every call. The content script [11] shares its tab with claude.ai and never holds the token, never calls the daemon, and adds nothing to the page's window while the extension runtime exists; even its one preference, the corner panel's [19] fold, is kept in extension storage rather than the page's. A call from the page would carry the page's origin, and the daemon answers no CORS headers on purpose: a wildcard would let any site the user visits post to their dashboard. The worker holds the host permissions for the daemon's address and is not subject to CORS. What the extension types into a session comes only from the daemon, which composes it from labels the session itself offered; the extension never composes text of its own, never types on claude.ai's sign-in pages, never navigates a tab it did not open, never acts in a child frame, and drives only the one Driver tab [2]. The reports it draws for diagnosis carry structure and lengths, never message text.

### Version lockstep with the daemon

#### Context

**Problem**: a version-skewed extension does not fail loudly, it half-works, with missed messages and silently ignored fields, which reads as a dashboard bug.

#### Business logic

Every call the worker [8] and the options page make states the manifest's version, `0.12.0`. A daemon expecting another version refuses every call outright, with a message naming both versions and the way out (update the extension, then reload it at `chrome://extensions`). The options page shows that message verbatim on "Save and test", and a cycle [15] records the refusal as its reason.

### What the manifest grants

#### Context

**Problem**: an extension can touch exactly what its manifest asks for, and Chrome may leave a declared site switched off for an unpacked extension.

#### Business logic

The extension is "The Framework: Claude web bridge", version `0.12.0`. Its content script [11] runs on `https://claude.ai/*` once a page is idle, in the top frame and in every child frame; child frames report upward, the top frame draws and is driven; claude.ai is the only site the page half touches. Its host permissions are `http://localhost/*` and `http://127.0.0.1/*`, the addresses a daemon on this machine listens on: they are what lets the worker [8] call the daemon without CORS, and a dashboard at any other address is out of the extension's reach. Its permissions are extension storage (the bridge token [9], the dashboard address, the Driver switch, the last cycle's [15] record and the corner panel's [19] fold; the Driver tab's [2] id and its pause in the session-scoped part, which Chrome clears when the browser restarts), tabs (open, pin, find, reload and message the Driver tab, and notice it closing) and alarms (the half-minute clock that wakes the worker). Declaring a site does not grant it: Chrome lists each under "Site access" with its own switch, and without the localhost grant the worker's call is blocked before it leaves the browser, which looks exactly like a wrong token. So the options page checks the grants before it tests the token, and the README tells the user to switch `http://localhost/*`, `http://127.0.0.1/*` and `https://claude.ai/*` on.
