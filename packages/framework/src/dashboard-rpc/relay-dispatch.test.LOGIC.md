What the tests cover:

- **The whitelist** - the relayable calls are exactly the reads about an agent and the steering of it (the project's files, the agent's own files, a file's diff and content, the agent's changes, the git status, the agent's checkout, its handoff and the agent itself; stopping, answering a gate, messaging, opening the pull request, merging it), and starting an agent, deleting one and removing a checkout are not relayable.
- **Unknown names** - a name off the list, a start included, is refused as an unknown relay call.
- **The home project** - a whitelisted call runs against this device's home project, the caller's project id being dropped, and answers its own empty shape when no such home project is registered.
