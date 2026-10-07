What the tests cover:

- **Nothing already waiting is announced** - the pull requests and the agents present the first time a project is read completely are absorbed silently; only an item that appears afterwards fires a notification, and it fires exactly once.
- **An agent parking on a question** - a question that appears after the baseline fires a notification whose body carries the question as the agent asked it, and whose title names the "Human Queue".
- **A read that reached no project is not a baseline** - repeated empty reads that reached nothing announce nothing and earn no baseline, so the first read that does reach the project treats its whole backlog as already there, and only the next new item is announced.
- **One project's silence does not gag another** - a project that answers keeps announcing its new items while another project never answers; when that other project finally answers, its backlog is absorbed as its baseline rather than announced.
- **The preferences gate** - with the feed's notifications off, nothing is ever shown, and turning them back on does not replay anything that arrived while they were off.
- **An agent starting and finishing are two announcements** - a started agent fires a notification titled "Agent started" carrying what it is building; the same agent finishing fires a second one titled "Agent finished".
