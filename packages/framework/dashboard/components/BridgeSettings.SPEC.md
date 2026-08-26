The settings panel for pairing the Claude web bridge: it hands the user the bridge token to paste into the browser extension, and tells them when the extension is being turned away.

## User story

- The user wants a cloud session's parked question to reach their dashboard instead of only appearing on claude.ai, and needs to connect the browser extension to this daemon.
- The user's bridge stopped working after an update and they need to know why.

## Business logic — TL;DR

- **Pairing is done from the dashboard, not by hand** - the panel explains the extension's setup and hands over the token, so nobody has to edit the registry file.
- **The token is revealed on request** - it is masked by default, revealed on demand, and copyable in one click.
- **No token yet means a restart is needed** - the token is generated when the daemon starts.
- **A turned-away extension says why** - a version mismatch and a rejected token are each reported with the fix, rather than looking like a silent disconnection.
- **Shown only for the user's own Chrome** - the panel exists once the bridge is enabled and the user has chosen their own Chrome to do its work; a browser the daemon runs is handed the token itself and shows its own line instead.

## Business logic

### Pairing is done from the dashboard, not by hand

#### User story

The user enables the bridge and needs to connect the extension to it.

#### Business logic

Once the bridge is enabled, the panel states what to do: install the browser extension, open its options, and paste the token shown here. It explains what that buys — the extension reports the question a cloud session is parked on, so it shows up in the dashboard instead of only on claude.ai.

#### Rationale

Without this panel the feature was unusable: turning the bridge on meant editing the registry by hand, and getting the token meant copying a field out of that same file. A token nobody can find is a feature nobody can enable.

### The token is revealed on request

#### User story

The user copies the bridge token into the extension, sometimes while screen-sharing or recording a demo.

#### Business logic

The token is shown masked, with a control to reveal it and hide it again, plus a one-click copy that never requires revealing it. Revealing resets whenever the bridge is switched off.

#### Rationale

Showing the token is not itself dangerous — anyone who can load the dashboard can already start agents on this machine. It is masked because a secret permanently on screen is a secret in every screenshot and screen recording, and this dashboard gets demoed.

### No token yet means a restart is needed

#### User story

The user enables the bridge for the first time and there is no token to copy.

#### Business logic

When no bridge token exists, the panel says to restart the dashboard to generate it. That is a genuine requirement: the token is read when the daemon starts.

### A turned-away extension says why

#### User story

The user pulls a new version of the repo and the bridge stops working.

#### Business logic

While the bridge is enabled, the panel keeps checking the bridge's status and reports the two ways the daemon turns the extension away:

- The extension's version does not match what this dashboard expects. The panel names both versions and says to update the extension: pull the repo, then reload the extension in the browser's extension page.
- Something is calling the bridge with a token the dashboard rejects, so its calls get nowhere. The panel says to open the extension's options and save the token shown here again.

A version mismatch takes precedence over a rejected token in what is shown. The check is repeated on a timer because the condition clears on the extension's own next call, not on anything the user does in the dashboard.

#### Rationale

A rejected token is refused before the version is even examined, so an extension that is stale in both its code and its token never records a version claim at all — the refused-contact record is the only trace, and without reporting it that failure is invisible everywhere.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
