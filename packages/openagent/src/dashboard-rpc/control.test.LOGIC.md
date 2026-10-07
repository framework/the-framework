What the tests cover:
- **Starting an agent** - the trimmed prompt, the user's picks and the project id reach the daemon's start, and its answer comes back; a prompt with no picks sends none; an empty prompt is refused with "a non-empty prompt is required" and the daemon's start is not called.
