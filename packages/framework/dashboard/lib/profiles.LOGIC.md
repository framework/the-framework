Keeps the list of devices [1] this browser can hop to, and performs the hop. A saved device is a connection, not a driver: each machine's daemon serves its own dashboard, so switching to a device means navigating this browser to that daemon's address, carrying the device's token for the one hop that authenticates it. The list, and each device's token, are kept in this browser's own storage and never in the user's preferences [2].

## Context

**User story**: the user starts The Framework on a second machine and binds it to the network. That machine prints a warning and one address with a token in it. The user pastes that address into the dashboard, which saves the machine as a device [1] with a label. From then on the device is one click away: clicking it opens that machine's dashboard, already signed in, with whatever prompt was being typed carried across. A "Local" entry always comes back to this machine.

**Problem**: a device's token is code execution on that machine for whoever holds it, and it is the only guard on a daemon bound to the network. It is also personal to the browser that was given it. Storing it with the daemon would put one person's secret into a file every browser reading that daemon can see; so the tokens stay in the browser that was told them, and nothing about a device is ever sent to a daemon except as the token on the connecting request.

## Glossary

[1] device: Another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[2] preferences: The user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[3] composer: the prompt editor on a project's page, also used for live chat.

## Business logic — TL;DR

- **The saved devices live in this browser** - the list and its tokens are per-browser and never reach any daemon's stored settings.
- **Saving a device from the address it printed** - the origin and the token are split out of the pasted address; anything that is not a web address is refused.
- **One entry per machine** - a device is keyed by its origin, so pasting the same machine again refreshes its token instead of adding a duplicate, and it moves to the top.
- **The label** - the label the user typed, or the machine's host and port when none was given.
- **Hopping to a device** - the browser navigates to the device's address with its token, carrying the prompt being typed so the hop never loses it.
- **"Local" comes back to this machine** - the loopback address the dashboard was first opened on is remembered, so "Local" returns to the right port even from another machine.
- **Which daemon is connected** - a loopback address reads as "Local"; anything else reads as the saved device's label, or its bare host when it was never saved.
- **A corrupt or absent list reads as empty** - malformed entries are dropped and unreadable storage yields no devices, never an error.

## Business logic

### The saved devices live in this browser

#### Context

See `## Context`.

#### Business logic

The devices [1] are stored by this browser, on this machine, under the origin the dashboard was opened on. Each entry is a machine's address, its token, and its label. Nothing is written into the user's preferences [2], because those live in one file on the daemon's machine and are read by every browser that opens that dashboard, which is the wrong home for a secret told to one browser.

Every screen showing devices reads the same list, and any change to it updates them all at once. On a page rendered before the browser is running there is no storage, so the list is empty and fills in once the page is live.

### Saving a device from the address it printed

#### Context

**User story**: a daemon bound to anything other than loopback prints one address of the form `http://<host>:<port>/?token=<token>`. That address, pasted into the dashboard, is all the user has to supply.

#### Business logic

A pasted address is split into the machine's origin and its token. Everything after the origin is discarded, so the saved address is the bare origin — which is what lets the dashboard recognize later that it is currently connected to that device [1].

Only `http` and `https` addresses are accepted. A paste with no scheme, such as `localhost:4200/?token=…`, is not a device address and is refused, as is anything that is not a web address at all. An address with no token in it saves with an empty token.

### One entry per machine

#### Context

**Problem**: the user pastes the same machine's address again after that machine was restarted with a new token. Adding a second entry would leave two rows for one machine, one of them with a token that no longer works.

#### Business logic

A device [1] is identified by its origin. Saving one that is already saved replaces it — new token, new label — rather than adding a second entry. The saved or re-saved device goes to the top of the list, so the list reads newest first.

A device is removed by its origin, and removing it takes its token with it.

### The label

#### Context

**User story**: the user names a machine ("laptop", "the big box") so the device [1] menu reads as their machines rather than as addresses.

#### Business logic

The label is the text the user gave, trimmed. A label that is empty or only whitespace falls back to the machine's host and port from its address (for example `192.168.1.5:4200`). An address the browser cannot parse falls back to the address as pasted.

### Hopping to a device

#### Context

**User story**: the user is halfway through typing a prompt, realizes it should run on another machine, and picks that device [1]. The other machine's dashboard opens with the prompt still in the composer [3], ready to start there.

**Problem**: the token has to reach the other machine once to establish the session. It rides the address for that one hop and is then held by that machine's dashboard as a cookie, so it does not stay in the address bar.

#### Business logic

Hopping navigates the browser to the device's [1] origin with its token attached, plus the text currently in the composer [3]. The receiving daemon accepts the token, removes it from the address, and leaves the carried draft, so the other machine's dashboard opens with the same prompt in its composer.

A draft is only carried when it fits: measured in its encoded form, anything longer than 7000 characters is dropped and the hop connects with an empty composer, so a very large paste cannot make the address unusable. A device with no token connects to its bare origin.

This is a connection, not the start of an agent: nothing is submitted by hopping, and the user starts the agent on the other machine.

### "Local" comes back to this machine

#### Context

**User story**: after hopping to a device [1], the user clicks "Local" to come back to their own machine — and lands on the port their own daemon actually uses, not a guess.

#### Business logic

Whenever the dashboard is opened on a loopback address, that address is remembered as this machine's own. "Local" navigates there, with no token. When nothing was ever remembered, "Local" falls back to the default daemon address `http://127.0.0.1:4200`. Opening the dashboard on anything other than a loopback address remembers nothing, so a device's address can never become the "Local" one.

### Which daemon is connected

#### Context

**User story**: the dashboard always says which machine it is showing, so work is never started on the wrong one by mistake.

#### Business logic

When the dashboard is served from a loopback address, the connection reads as "Local" and is marked as this machine. Otherwise it reads as the label of the saved device [1] whose origin matches, and, when no saved device matches, as the bare host of the address the dashboard was served from. What counts as loopback is decided by the same rule the daemon uses to decide whether to demand a token, in `loopback-host.ts`.

### A corrupt or absent list reads as empty

#### Context

**Problem**: browser storage can be unavailable, disabled or hand-edited. None of that should be able to break the dashboard.

#### Business logic

Reading the devices [1] never fails: storage that cannot be reached, content that is not a list, and content that cannot be parsed all yield no devices. Entries within a valid list that are missing an address, a token, a label or an identity are dropped, and the well-formed ones are kept.
