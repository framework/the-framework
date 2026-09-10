What the tests cover:

- **Which agents get a cloud word** - only an agent whose location is `web` and whose local half ended cleanly; a local agent, a GitHub Actions agent, and a web agent that is still running, was stopped, or failed all get no cloud word, even one whose cloud session is reported as parked on a question.
- **The session window** - a web agent with no pull request reads "in cloud" while it is within 12 hours of its start, including exactly at the 12-hour mark, and "done" from one millisecond past it.
- **An unreadable start time** - an agent whose recorded start time is not a date reads "done", never "in cloud" forever.
- **Parked on a human wins** - an agent whose cloud session the bridge reports as holding an unanswered question reads "waiting", even when it already has a pull request and even when it started three windows ago.
- **A recorded pull request** - an agent with a pull request reads "done", the same word a finished local agent with a pull request shows, because the pull request's live state is not on the record.
- **Merged** - an agent whose pull request was merged reads "merged", including long past the session window; any other merge outcome, such as a merge withheld, leaves the word at "done".
- **Still at work** - "in cloud" and "waiting" count as an agent still at work; "merged", "done" and having no cloud word do not.
