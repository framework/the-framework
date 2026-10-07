The Settings panel for running the Claude web bridge [1] through the user's own Chrome: while the bridge is on, it tells the user to install the extension and paste the bridge token [1] into its options, hands over that token masked with "Reveal", "Hide" and a copy button, and names the two ways the extension can be failing to reach the daemon: a version the dashboard refuses, or a token it rejects. While the bridge is off the panel is absent.

## Context

**User story**: on Settings, under "Which browser does the work?", the user picks "Your own Chrome", reads "Install the browser extension, open its options, and paste this token.", reveals the token, copies it into the extension, and from then on a question a cloud session [2] is parked on shows up in the dashboard. After pulling a newer repository, the user sees in the same panel that the extension is out of date rather than merely disconnected.

**Problem**: a token nobody can find is a feature nobody can enable, and an extension refused by the daemon looks, from the outside, exactly like one that is disconnected.

## Glossary

[1] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents.
[2] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **The setup text and the token** - the instruction to install the extension and paste the token, then the token masked as 24 dots with "Reveal"/"Hide" and "Copy the bridge token"; "Restart the dashboard to generate the token." when the daemon has none yet.
- **A blocked extension** - when the extension's version is refused, a red notice names its version and the expected one and says to pull the repository and reload the extension at chrome://extensions.
- **A rejected token** - when the last call to the bridge was refused for its token, and no version block is showing, a red notice says to save the token shown below into the extension's options again.

## Business logic

### The setup text and the token

#### Context

See `## Context`.

#### Business logic

While the bridge [1] is on, the panel reads "Install the browser extension, open its options, and paste this token. It reports the question a Claude web session is parked on, so it shows up here instead of only on claude.ai." Under it is the bridge token, hidden behind 24 dots until "Reveal" is pressed ("Hide" puts the dots back), with a copy button named "Copy the bridge token" that copies the real token whether or not it is shown. The token is revealed on request rather than shown outright so that a secret is not permanently on screen in every screenshot and recording. The token is the one the daemon generates when it starts with the bridge on; when the daemon has none to hand over, the panel says "Restart the dashboard to generate the token.", since the token is read when the daemon starts. Turning the bridge off removes the panel, forgets the fetched token and hides it again for the next time.

### A blocked extension

#### Context

**Problem**: the daemon refuses an extension whose version does not match the dashboard's, and after a repository pull "the bridge stopped working" is exactly this; the block is only cleared by the extension's own next call, never by anything this page does, so the page keeps asking.

#### Business logic

While the bridge [1] is on, the panel asks the daemon for the bridge's status every five seconds. When the status says the extension's last version claim was blocked, a red notice reads "The extension is blocked: it is v<its version> and this dashboard expects v<the expected version>. Update it — pull the repo, then reload the extension at chrome://extensions." The notice disappears on its own once a later claim is accepted.

### A rejected token

#### Context

**Problem**: a call with a stale token dies before the version check, so an extension that is out of date in both its copy and its token never even records a version; the daemon's record of the refused contact is the only trace, and without this notice that failure is silent everywhere.

#### Business logic

When the bridge's [1] last recorded contact was refused as unauthorized, and no version block is showing, a red notice reads "Something is calling the bridge with a token this dashboard rejects, so the calls get nowhere. Open the extension's options and save the token shown below again." A version block outranks it: fixing the token comes first, and once that lands the version notice carries the more specific cure, so the two are never shown together.
