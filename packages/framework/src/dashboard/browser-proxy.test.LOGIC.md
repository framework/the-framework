What the tests cover, against a real server standing in for an agent's browser bridge [1]:

- **Reading the address** - an address of the form `/browser/<project>/<agent>/stream` or `.../input` is understood as naming that project [2], that agent [3] and that leg, and a query string after it changes nothing.
- **Anything else is not a browser request** - the dashboard's own addresses, the prefix alone, an address missing the agent [3] or the leg, an extra path segment, and a leg the relay does not serve are all ignored and left to be served as ordinary dashboard addresses.
- **A malformed address never throws** - a broken escape sequence in the agent id [3], or a target that is not a valid address at all, is ignored rather than crashing the daemon.
- **The picture leg reaches the bridge** - a request for the live picture arrives at the agent's browser bridge [1] and its endless-image response is passed straight back to the dashboard.
- **The input leg carries the click** - a click posted by the dashboard reaches the browser bridge [1] with its contents intact.
- **No preview is an ordinary answer** - an agent [3] with no browser, or one that has ended, is answered "not found" without any attempt to reach a bridge.
- **A bridge that is gone answers rather than hangs** - when the agent's browser bridge [1] can no longer be reached, the dashboard gets a gateway error instead of a request that never completes.
- **Non-browser addresses fall through** - a request for anything outside the browser prefix is reported as unhandled, so the daemon can serve the dashboard itself.

## Glossary

[1] browser bridge: the small server an agent runs beside its browser while it works, which serves the live picture of that browser and accepts clicks and keys for it.
[2] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control. Its agent id is derived from the moment it started.
