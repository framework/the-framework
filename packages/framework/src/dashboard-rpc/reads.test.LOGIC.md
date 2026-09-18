What the tests cover:

- **An unknown project answers empty** - the checkout's files are an empty list, the file statuses an empty map, a ticket's plan author nothing, and where an agent is working nothing, never an error.
- **The schedulers over an empty registry** - with no project registered the schedulers read answers an empty list.
- **An unsafe agent id is refused** - asking where an agent is working with an id that could escape the checkouts directory answers nothing.
- **A web agent waiting on a human is marked** - a `web` agent whose cloud session the bridge holds a parked question for is handed to the dashboard as waiting; a `web` agent with another session, and a local agent even with that session id, are not.
- **An agent another machine started is marked** - an agent whose recorded host differs from this machine's is marked as from another host; one from this host is not; one with no recorded host says nothing about where it ran.
- **An agent still publishing is marked** - an agent that ended clean while its process is still alive on this machine is marked publishing; one whose process is gone, one still running, waiting, stopped or failed, one from another host, and one with no recorded process are not.
