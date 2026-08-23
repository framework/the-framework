The browser preview: streams the agent's own headless Chrome as a live picture a person can watch, and carries their clicks, typing, scrolling and navigation back into it.

## User story

- An agent hits a login wall or a captcha and parks, asking a human to deal with it. Its browser is headless and belongs to the agent, so without this there is nothing for that person to click.
- The user watches the agent's browsing in the dashboard and takes over the page when they need to.

## Business logic — TL;DR

- **Watch the page the agent is on** - the picture follows the agent when it opens or switches tabs, rather than freezing on whichever page happened to be first.
- **Click, type, scroll, navigate** - a human's input is delivered to the agent's page; anything that is not one of those four is delivered as nothing.
- **A still page still paints** - the newest picture is re-sent on an interval and immediately to anyone who has just started watching.
- **Nothing leaves the machine** - the stream is reachable only from this device, and no frame is ever written to disk or onto the agent's event log.
- **No pane beats no agent** - a browser with no page to stream simply gets no preview; the agent carries on.

## Business logic

### Showing the agent's current page

#### User story

The agent opens a new tab mid-task. The person who was asked to log in must be looking at that tab, not at the one the agent has left behind.

#### Business logic

The page shown is the browser's most recently used one, and pages with no live debugger connection (a crashed or detached tab) are ignored rather than shown as an unusable pane. The preview re-checks on an interval and moves to the agent's new tab when it changes; if it cannot attach to the new one it keeps showing the page it already has rather than dropping the pane.

Whenever the page a person would be looking at changes — a navigation in place, or a followed tab switch — the new address is announced, starting with the first real page. The browser idling on a blank or internal page is not the agent showing something, so those are never announced, and the same address is never announced twice in a row.

### Keeping the picture painted

#### User story

An agent parked on a login wall is not repainting itself, and the person asked to help must not be looking at a blank pane.

#### Business logic

The newest picture is re-sent on an interval while anyone is watching, and sent immediately to a viewer who has just opened the pane. Without the repeat, the last picture is held back unpainted until the next one arrives — and a still page never produces a next one, which is exactly the case the preview exists for.

### Taking over the page

#### User story

The user needs to type a password, dismiss a captcha, or navigate somewhere the agent got stuck reaching.

#### Business logic

A click is delivered as a press followed by a release, since a press alone does nothing. Typing is delivered as inserted text rather than key codes, which is what makes non-ASCII characters and password managers work. Scrolling and navigation to an ordinary web address are delivered as themselves; navigation to anything else is refused. Anything unrecognized, malformed, or larger than a plausible input is delivered as nothing at all and reported back as rejected, so nothing but real input ever reaches the agent's browser.

### Keeping the agent's browser private

#### User story

The frames can show whatever the user is typing, including a password.

#### Business logic

The preview is served on this device only and is never reachable from the network; no frame is ever written to disk or onto the agent's event log. The port it listens on is published on the agent's log so the daemon can proxy it to the dashboard.

#### Rationale

The agent hosts the preview rather than the dashboard driving Chrome directly because Chrome refuses debugger connections that carry a web page's origin unless it is launched with that restriction lifted — and lifting it would let any page the user happens to visit drive the agent's browser. The debug port stays unreachable from the web, and this preview is the only way in.

The picture is served as a stream of images an ordinary image element renders on its own, and input arrives as a plain form post, so the dashboard needs no client library and The Framework needs no extra dependency.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
