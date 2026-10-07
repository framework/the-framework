What the tests of the DevTools port helpers cover.

- A free port is a real port number.
- Waiting for Chrome answers `true` once a server on that port answers `/json/version`.
- Waiting for Chrome gives up with `false`, within its bound, when nothing ever listens.
