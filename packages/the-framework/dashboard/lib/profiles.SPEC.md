Manages the devices this browser can hop to: saving another machine's daemon from the URL it prints, listing them, switching the browser over to one, coming back to the local machine, and telling the user which daemon they are currently talking to.

## Glossary

- **hop** - switching devices by navigating the browser to that daemon's own origin, rather than the current daemon proxying anything.

## Business logic — TL;DR

- **Switching device is a navigation** - the dashboard is served by its daemon, so hopping to a device means going to that daemon's origin, handing over the token once so it can set its own cookie.
- **Devices live in the browser** - a device's token is a per-browser secret and is never sent to the daemon's registry.
- **One entry per machine** - a device is saved by its origin, so pasting the same machine again refreshes its token instead of stacking a duplicate.
- **A hop carries the typed prompt** - the composer draft travels with the hop, so switching device never loses what the user had written; an oversized draft is dropped rather than risking the URL.
- **"Local" goes back to where the dashboard was launched** - the loopback origin is remembered, so returning works even from a remote machine and on a non-default port.
- **The connected indicator** - loopback reads as "Local"; anywhere else reads as the saved device's label, or the bare host when the machine is not saved.

## Business logic

### Switching device is a navigation

#### User story

The user has The Framework running on more than one machine and wants to work on another one from the dashboard in front of them.

#### Business logic

Each daemon serves its own dashboard, so switching to a device navigates the browser to that device's origin, with its token attached once. The destination daemon consumes the token on arrival to set up its own session, after which everything the dashboard does is against that daemon directly. Returning to the local machine is the same navigation without a token.

#### Rationale

Switching device is a connection change, not a way to run an agent elsewhere — the relay is a separate mechanism. Because every daemon serves its own dashboard, a hop keeps every request the dashboard makes on the same origin it was served from, instead of introducing cross-origin traffic.

### Devices live in the browser

#### User story

The user pastes a device's URL and token into the dashboard on one browser.

#### Business logic

Saved devices are stored in the browser rather than in the registry, and are read back defensively: an unreadable store yields no devices, and malformed entries are ignored rather than breaking the list. The devices are listed newest first.

#### Rationale

A device's token is a per-browser secret. Putting it in the daemon's registry would be the wrong home, since that file is shared by every browser that reaches the daemon.

### One entry per machine

#### User story

The user pastes the same machine's URL again — typically because its token was reissued.

#### Business logic

A device is identified by its origin. Saving one that is already known replaces it in place, refreshing its token, and moves it to the front. A device given no name is labelled by its host and port. A device is dropped by the same identity.

The URL the daemon prints when it binds beyond loopback carries both the origin and the token; pasting it is split into those two parts, with the origin reduced to its bare form so it matches what the connected indicator compares against. A paste that is not a URL is rejected.

### A hop carries the typed prompt

#### User story

The user starts typing a task, then realises it belongs on another machine and switches device.

#### Business logic

The composer draft travels with the hop and is restored into the composer on the far side, so switching device never discards the typed prompt. A draft beyond a size cap is left behind and the hop proceeds as a plain connect, so an outsized paste cannot break the URL.

### "Local" goes back to where the dashboard was launched

#### User story

The user hopped to another machine and now wants to come back to their own — possibly having launched the local daemon on a non-default port.

#### Business logic

The loopback origin the dashboard was launched from is remembered while the user is on it, and "Local" returns there. With nothing remembered, it falls back to the default daemon address, http://127.0.0.1:4200.

### The connected indicator

#### User story

Once devices are in play, the user must be able to see at a glance which machine they are looking at.

#### Business logic

A dashboard served over loopback is reported as "Local". Anywhere else it is reported by the matching saved device's label, or by the bare host when that machine has not been saved.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
