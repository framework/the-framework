What the tests cover: the routes a web run uses to ask its daemon for an extension-created cloud session.

- A run queues a request, reads it back as queued, and — once the extension's side has claimed and reported it — reads the created session's id and URL.
- A failed creation reads back as failed with the extension's note.
- With no extension around, the request is refused at once as a conflict naming that reason.
- The routes demand the daemon token (missing and wrong both refused), refuse a malformed request and a body that is not an object, reject the wrong method, treat an unknown or malformed id as not found, and do not exist when the bridge is off.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
