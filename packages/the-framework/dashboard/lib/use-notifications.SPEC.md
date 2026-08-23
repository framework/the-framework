Browser notifications for the two cross-project feeds the dashboard already watches: interventions, the "needs you" list, and activity, the agent-started / agent-finished feed. Whether an item counts as new, and which items are treated as already-known backlog, is decided exactly the way the daemon's Discord notifier decides it, so the two notification channels can never disagree about what is new. What is specific to the browser is the wording of each notification and where clicking it takes the user.

## User story

- The user leaves the dashboard open in a tab while doing something else, and wants to be told the moment an agent needs an answer, or an agent starts or finishes — without watching the screen.
- The user does not want to be told about work that was already waiting when they opened the page.
- The user turns notifications off for a while and back on, and must not then be told about everything that piled up in between.

## Business logic — TL;DR

- **Two gates before anything fires** - the category must be switched on *and* the browser must have granted permission; without both, nothing is shown.
- **Backlog is absorbed, never announced** - the first time a project's feed is read in full, everything already in it becomes the baseline, so the user only hears about what happens from then on.
- **The backlog is absorbed even while notifications are off** - what happened while the toggle was off stays "already there", so flipping it back on does not replay it.
- **Flipping the toggle is not a new reading of the feed** - only a genuinely fresh read of the feed can produce notifications.
- **Several new items become one notification** - the title counts them and the body lists them, one line per item.
- **A click goes where the item lives** - a pull request opens on GitHub in a new tab; everything else brings the dashboard tab forward, because those items live in the dashboard and the project the user is looking at is not part of the URL.

## Business logic

### Only what happens while you are watching

#### User story

See `## User story`.

#### Business logic

Each project's items become known the first time that project's feed is read in full, and nothing already present at that moment is announced. From then on, only genuinely new items produce a notification.

Items are absorbed whether or not notifications are switched on, which is what keeps turning the category off and on again from replaying everything that accumulated while it was off — that is still backlog, not news. Merely flipping the toggle is likewise not a new reading of the feed: the same items are not re-examined, so the toggle itself can never produce a notification.

#### Rationale

Backlog used to be recognised by counting readings rather than by whether the project's feed had been read in full: the first two readings were treated as baseline, whatever they contained. A dashboard opened while the daemon could not reach GitHub spent both of those on empty lists, so the first reading that did reach GitHub announced every already-open pull request as brand new.

### What each notification says and where a click goes

#### User story

The notification has to be readable at a glance and take the user to the thing it is about.

#### Business logic

For interventions, a single new item is titled "Human Queue" followed by the project's name; several are titled as a count of items in the Human Queue. Each item reads according to what it is: an agent parked at a gate reads as its own question; finished work that was never pushed reads as its title followed by how many commits are sitting unpushed, or simply "work not pushed" when that count is not known; a pull request reads as its number and title. Clicking a pull request opens it on GitHub in a new tab; clicking a parked agent or unpushed work brings the dashboard tab forward instead.

For activity, a single item is titled "Agent started" or "Agent finished" followed by the project's name, and several are titled as a count of agent updates. Each line reads "Started:" or "Finished:" followed by the agent's title, or "a session" when the agent has no title yet. Activity always brings the dashboard tab forward, since there is nowhere external to go.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
