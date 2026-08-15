---
'@gemstack/the-framework': patch
---

Fixed a rare false failure in the browser proxy's "the bridge is gone" test. It freed the fake bridge's port before asking the OS for the proxy's own, and the ephemeral pool hands a just-released port straight back often enough to matter (~1 in 1500 on Linux) — so the proxy was occasionally pointed at itself, did not recognise the bare `/stream` it dialled as a browser route, and answered with its own fall-through 404 where the test expected the refused connection's 502. The proxy now takes its port while the bridge still holds one, so the two can never be the same number. Test-only; the proxy itself was always right.
