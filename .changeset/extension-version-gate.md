---
'@gemstack/the-framework': minor
---

A browser extension whose version does not match the daemon's is now blocked outright instead of half-working. A stale extension never failed loudly — it missed messages and silently ignored fields the newer protocol added, which read as dashboard bugs and burned debugging sessions on a problem whose only fix is reloading the extension. Every bridge call now states the extension's version, and a daemon expecting another refuses every route with an error naming both versions and the update path; the options page's connection test shows that answer verbatim, and the dashboard's bridge settings say the extension is blocked — with both versions — instead of the bridge merely looking disconnected. A test keeps the daemon's expected version and the extension's manifest in lockstep, so one cannot be bumped without the other.
