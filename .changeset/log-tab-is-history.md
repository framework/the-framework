---
'@gemstack/framework-dashboard': patch
---

The right rail's `Log` tab is now `History`, and every tab says what it holds on hover (#1145). One word only works for a reader who already knows the system: "Log" was read as agent output or a console stream rather than the project's durable, committed session history. The panel itself now names what it is and where it comes from, and its empty state says no finished sessions rather than no log entries.
