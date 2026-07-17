---
'@gemstack/framework': minor
---

"New activity" notifications (#627): a default-off notification *category* alongside the always-on "needs you" one. Turn it on (the new Activity toggle in the header, beside the browser bell and Discord toggle) and you get a ping when a run starts and when it finishes, not just when something needs you. It is a category, not a method, so it rides whichever delivery methods are on: browser notifications when the bell is on. A cross-project `onActivity` feed (`buildActivity`) drives it, diffed the same way as the interventions queue, so the runs already going when the page loads are folded into a baseline rather than announced.
