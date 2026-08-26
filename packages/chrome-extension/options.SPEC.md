The Claude web bridge's settings page: where the user points the extension at their dashboard, pastes the daemon token, and switches the Driver tab on or off — and where saving those settings immediately proves whether the bridge actually works, naming which failure it is when it does not.

## User story

The bridge has several ways to be misconfigured, and from the dashboard they all look identical: no question ever arrives. The user wants one place where pressing Save tells them, in one sentence, whether the bridge is working and — if not — exactly which thing to fix.

## Business logic — TL;DR

- **Three settings, stored by the extension** - the dashboard URL, the daemon token, and whether the Driver tab runs; kept in the extension's own storage so nothing on claude.ai can read the token.
- **Saving is followed by proving** - every save runs a connection test, because a token that is merely stored tells the user nothing.
- **Each failure is named, not merely reported** - browser permissions not granted, bridge switched off, token rejected, extension too old, dashboard too old, or daemon unreachable are six different messages with six different fixes.
- **Success answers the next question too** - a working connection also reports how many recent cloud sessions the daemon lists and whether the Driver tab serves them.
- **A cycle can be run on demand** - a button runs a Driver cycle immediately and reports what it did, or why it did nothing; it also resumes a Driver paused by closing its tab.
- **The last cycle's outcome is on the page** - what the service worker's most recent cycle did, or why it did nothing — including that it reloaded the extension because its files changed on disk — is shown when the page opens, with the time, and kept current while the page stays open.

## Business logic

### The settings

#### User story

See `## User story`.

#### Business logic

Three things are stored: the dashboard's URL, defaulting to `http://localhost:4200` and kept without trailing slashes; the daemon token, which the user pastes from The Framework; and whether the extension may run its Driver tab, which is on unless the user turns it off. The Driver switch is written out explicitly rather than left unset, so the extension's service worker never has to guess a default. Saving without a token is refused with a prompt to paste one.

### Proving the connection

#### User story

The user pastes a token, presses Save, and needs to know within a second whether questions will now reach their dashboard.

#### Business logic

Saving is immediately followed by a test, reported as one sentence. It walks a ladder, and each rung is a distinct diagnosis:

- **The browser has not granted access.** Before anything is sent, the extension checks that it actually holds permission for both the dashboard's origin and claude.ai. If either is missing, the test stops and names the missing origins along with where to switch them on (`chrome://extensions`, under Site access).
- **The dashboard rejected the token.** Reachable, but the token is wrong.
- **The bridge is off.** The dashboard answered, but the bridge route is not open; the fix is turning the bridge on in The Framework.
- **The extension is the wrong version.** The daemon's own refusal is passed through verbatim, because it already names both versions and the way out.
- **The dashboard has no bridge route.** The dashboard answered successfully but with its own web page rather than the bridge's acknowledgement, which means a build of The Framework that predates the bridge; the fix is updating it.
- **The dashboard is unreachable.** Nothing answered at that URL.

Only a clean acknowledgement counts as connected, and a connected result goes one step further: it counts the cloud sessions the daemon currently lists and says that the Driver tab serves them, or that the Driver tab is switched off, or that there is nothing recent to watch.

#### Rationale

Declaring the sites an extension needs is not the same as holding access to them — the browser lists each one with its own switch, and for an extension loaded from a directory they can sit off. Because the daemon deliberately answers no cross-origin headers, a missing grant means the extension's request never leaves the browser at all and the daemon sees nothing, which is indistinguishable from a wrong token. That is checked first for exactly that reason.

The acknowledgement text is checked rather than just the success status because the dashboard serves its own web page for any address it does not recognise: a build with no bridge would answer successfully with a page of HTML, and calling that "connected" would tell someone their bridge works when it does not exist.

### Running a cycle on demand

#### User story

The user turns the Driver on and then sits watching a browser where nothing happens, with no way to tell whether it is broken or merely not due yet — or closed the Driver tab and wants it back.

#### Business logic

A button lifts the pause a closed Driver tab left behind, asks the extension's service worker to run a cycle right now, and reports the result: the cycle's own summary — how many sessions were read and with which statuses, how many visited, typed and created — or, when it did nothing, the reason, whether that is no token, the Driver being switched off, an unreachable or refusing daemon, or simply nothing to drive. A worker that does not answer at all is reported as such, with reloading the extension as the fix.

#### Rationale

The scheduled cycle runs twice a minute, which is a long time to sit wondering whether something is wrong.

### Showing the last cycle

#### User story

The user wants to know what the bridge last did without pressing anything, and without opening the service worker's console — including whether the worker restarted because the extension's files were edited.

#### Business logic

The service worker records the outcome of every cycle it runs — whether it succeeded and its one-line reason — and the time; the page shows that record as one line when it opens: the time, "failed" when the cycle did, and the reason. When no cycle has run yet the line says so. The line is updated the moment the worker records a new outcome, so a page left open follows the bridge as it runs, and a reload the worker did because its files changed on disk is shown with the changed files' names.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
