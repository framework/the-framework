The rules for the daemon's Discord credential — the notifications webhook: where it comes from, which source wins, what the dashboard is allowed to know about it, and what counts as a valid value.

## User story

The user wants Discord notifications. Enabling them must be finishable in the dashboard, rather than requiring them to edit the daemon's environment and restart it. A user running the daemon as a deployment must still be able to configure it from the environment, and have that win.

## Business logic — TL;DR

- **Two sources, the environment wins** - the credential comes from the daemon's environment, and otherwise from the registry.
- **Presence, never the value** - the dashboard is told which credential exists and where it came from, never what it is.
- **Validation rejects only what cannot possibly work** - a webhook must be an http or https URL, and nothing further is assumed about it.
- **No credential means no Discord** - notifications are simply off, not broken.

## Business logic

### Two sources, the environment wins

#### User story

The user's daemon runs in a container whose environment sets the webhook. Someone typing a different one into a browser must not quietly override the machine.

#### Business logic

The credential the daemon runs with is taken from the daemon's environment first and from the registry second; blank values in either place count as absent. An environment variable is how a deployment configures the daemon, so it takes precedence, and the dashboard says where the value came from rather than offering an edit that would not take effect.

### Presence, never the value

#### User story

The user opens the settings page and needs to know whether Discord is configured, and whether they can change it here.

#### Business logic

What the dashboard is told is which credential exists and which of the two sources it came from — never the credential itself. A stored credential is not a credential that can be read back.

The dashboard's access to credentials is optional: a host that does not provide one — the relay, serving another daemon — reports nothing configured and refuses writes, the same way user preferences degrade there.

### Validation rejects only what cannot possibly work

#### User story

The user pastes something that is not a webhook URL at all. They should be told immediately, rather than having it stored and silently do nothing.

#### Business logic

A webhook must parse as a URL and use http or https; anything else is refused with the reason. Clearing a credential is always allowed. Validation goes no further deliberately: a webhook is not required to be on Discord's own domain, because people front webhooks with their own proxies and the daemon has no business refusing a URL it was told to post to. Whether the credential actually works is Discord's answer to give, and the daemon logs it when it does.

The same validation is shared by the dashboard and the daemon, so what the browser accepts and what the daemon enforces cannot drift apart.

### No credential means no Discord

#### Business logic

When no credential resolves from either source, Discord notifications are simply off.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
