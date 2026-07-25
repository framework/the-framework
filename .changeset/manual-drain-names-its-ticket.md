---
"@gemstack/the-framework": patch
---

Tag the ticket a drain run implements when the drain is started by hand, not only when the daemon's sweep starts it. A drain fired from the dashboard worked the queue's next entry but recorded nothing about it, so the Overview's "in progress" lane stayed empty while the work was being done.
