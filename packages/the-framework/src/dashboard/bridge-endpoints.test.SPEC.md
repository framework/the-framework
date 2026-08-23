What the tests cover: the `/_bridge` routes the Claude web bridge's Chrome extension calls.

- **The parked question** - a valid question from a cloud session is accepted and handed to the dashboard, timestamped by the daemon rather than by the caller (a timestamp the caller supplies is ignored).
- **The bridge can be off** - a daemon with the bridge disabled answers every bridge route as not found and records nothing.
- **The daemon token** - a missing token, a wrong token of the same length, and a token of a different length are all refused, before the request body is read; the answer routes and the health check are guarded the same way, since reachability is not public information.
- **Validation** - a body that is not JSON, a body that is not an object, a malformed cloud session id, an empty title, an empty option list, an option without a label, more than twenty options, and a recommendation naming no listed option are each refused with a message naming what was wrong; nothing is recorded from a refused call.
- **Body size** - a body past the cap is refused or the connection torn down, never buffered, and never recorded.
- **Method** - the question route accepts only POST; the health check answers a literal `ok` body, which is what lets a caller tell a real bridge from a dashboard old enough to serve its app page for any unknown path.
- **No cross-origin headers** - responses carry none, so a page the user visits cannot post to their daemon on their behalf.
- **The answer round trip** - the extension is served the answer queued for a cloud session, gets an explicit "nothing to deliver" for a session with none, is refused for a malformed session id, and its report of whether delivery worked is accepted and passed on (with a malformed report refused). A daemon that queues no answers degrades to "nothing to deliver" rather than failing.
- **The extension version gate** - an extension claiming the wrong version, or too old to claim one at all, is refused on every route including the health check, with a message naming both versions and how to update; the matching version passes; every claim is reported to the dashboard, which is what clears a blocked banner once the extension is updated. The gate sits behind the token, so an unauthenticated caller learns nothing about which version is expected.
- **Lockstep with the extension** - the version this daemon expects and the version in the Chrome extension's manifest must be equal, so bumping one without the other fails here instead of in the user's browser.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
