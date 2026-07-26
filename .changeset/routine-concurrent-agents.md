---
'@gemstack/the-framework': minor
---

The routine can now keep several agents going at once (#1204). A "Concurrent agents" setting on the Routine work card (default 2, up to 10) drives how many runs the sweep keeps live per project, and a sweep tops a project up in one tick instead of one run per interval — so a standing queue fans out across parallel sessions, which is what makes ten Claude Code web sessions at once a single click. Concurrent drains are each pinned to their own queue entry so they never race for the first one, and landing a finished run's queue now merges its changes onto a checkout that moved in the meantime instead of overwriting it — the wholesale copy used to un-check entries a concurrent run had just retired and send the sweep off to redo them.
