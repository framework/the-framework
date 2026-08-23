The dashboard's handle for the saved-device health check: the browser hands the daemon each device's address and token, and gets back which of them answered, feeding the reachability dot next to every saved device.

The handle is declared against the daemon's own implementation, so a change to the check breaks the dashboard at build time instead of failing as a missing route once a user opens the device list.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
