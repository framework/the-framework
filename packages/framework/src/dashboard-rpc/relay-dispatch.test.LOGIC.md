What the tests cover:

- **The whitelist** - the relayable calls are exactly the reads about an agent and the steering of it (the project's files and statuses, a file's diff and content, the agent's changes, the git status, the agent's checkout, its handoff and the agent itself; stopping, answering a gate, messaging, moving the handoff, pushing the branch, opening the pull request), and starting an agent, deleting one, removing a checkout and the preview are not relayable.
- **Unknown names** - a name off the list, a start included, is refused as an unknown relay call.
- **The home project** - a whitelisted call runs against this device's home project, the caller's project id being dropped, and answers its own empty shape when no such home project is registered.
