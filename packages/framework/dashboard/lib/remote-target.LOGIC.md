Remembers which saved device [1] the next agent [2] should be relayed [3] to, as picked in the launcher's [4] "Run on" control. Nothing is selected by default, which means the agent runs wherever its location [5] says — this machine or a GitHub Actions runner. A device is named here by its address, and the launcher looks that address up in the saved devices to attach the device's token to the start.

The selection lives only for as long as the page is open and is deliberately not part of the user's preferences [6]: reaching a device requires that device's token, which is a secret held by this browser alone, so where an agent [2] is sent is a choice made in the moment rather than a setting that would have to be stored somewhere every browser can read. Every part of the dashboard that shows the choice reads this one selection, so the launcher [4] and the devices list in Settings always agree on it.

## Glossary

[1] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[4] launcher: the Start form on a project's own page.
[5] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[6] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
