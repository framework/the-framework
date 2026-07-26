---
"@gemstack/the-framework": patch
---

Only the maintenance sweep describes itself now, in the Overview's Routine work card and the daemon's log line alike, since "Maintenance" alone does not say what it does. The other routines' labels already read as what they do, so their rows lose the line that repeated the label in different words and their log lines say the label itself (`AutoPmJob.describe` is optional, carried only by the maintenance job).
