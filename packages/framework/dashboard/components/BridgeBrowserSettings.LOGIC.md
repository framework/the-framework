The Settings line for the bridge browser [1], the Chrome for Testing the daemon runs for the Claude web bridge [1]: it says where that browser stands (off, starting with the step it is on, running minimized or shown, or stopped with the reason), tells the user when it is waiting on claude.ai's sign-in page, and offers the three things the user can do for it: show its window, hide it again, and restart it. It is shown only while the bridge is on and the daemon has reported a status, and it re-reads the status every three seconds.

## Context

**User story**: on Settings, under "Which browser does the work?", the user picks "A browser the daemon runs — recommended" and reads that the daemon is downloading Chrome, then that the browser is running minimized and sitting on claude.ai's sign-in page; the user presses "Show the window to sign in", signs in once, presses "Hide the window", and web agents [2] work with the user's own Chrome closed.

**Problem**: the bridge browser is minimized by design, so nothing about it is visible anywhere else; its first launch downloads Chrome and takes minutes, its window is the only place the sign-in can happen, and a browser the user quit stays quit until asked for again. Each of those would read as "the bridge is broken" without a line saying which it is.

## Glossary

[1] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge browser is the Chrome for Testing the daemon runs for it.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Off and starting** - "The bridge browser is off." or "Starting the bridge browser: <the step it is on>."
- **Running, and the sign-in window** - "The bridge browser is running, minimized." or "…with its window shown", plus the sign-in sentence when its claude.ai tab is on the sign-in page; buttons to show or hide the window and to restart.
- **Stopped** - in red, "The bridge browser is not running: <reason>." with "Restart"; a browser the user quit is not relaunched on its own.

## Business logic

### Off and starting

#### Context

See `## Context`.

#### Business logic

With the bridge browser [1] off the line reads "The bridge browser is off.". While the daemon is launching it, the line reads "Starting the bridge browser: <detail>." where the detail is the step the launch is on, as the daemon reports it; the first launch downloads Chrome, which is where the minutes go.

### Running, and the sign-in window

#### Context

**Problem**: whether a sign-in is needed is read by the daemon from which page its own browser's claude.ai tab is on, not from the extension's last hello, which the user's own Chrome may have written a second ago.

#### Business logic

While the browser runs, the line reads "The bridge browser is running, minimized." or "The bridge browser is running with its window shown.". When its claude.ai tab is on the sign-in page the line adds " It is on claude.ai's sign-in page: show the window and sign in once, then hide it again." Below it, one button toggles the window: "Hide the window" while it is shown; otherwise "Show the window", or "Show the window to sign in" when the sign-in is pending. A "Restart" button relaunches the browser. A request that fails is silently dropped; the next status read shows what actually happened.

### Stopped

#### Context

**Problem**: a browser that exits on its own was quit by an act of the user, so the daemon does not relaunch it; the dashboard must offer the way back.

#### Business logic

When the browser is not running after having been asked for, the line reads in red "The bridge browser is not running: <reason>." with the daemon's reason and a "Restart" button. Nothing relaunches it without that click.
