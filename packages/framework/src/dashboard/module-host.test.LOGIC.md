What the tests cover:

- **An agent's facts** - an agent with a checkout and a record gets both, with its branch; an agent that ended `done` on this machine without a pull request changed nothing, one from another machine or with a pull request did not; an agent with neither a checkout nor a record, and an id that is no agent id, have no facts.
- **A merge lookup** - says "still asking" only while the git host has not answered at all; answers the merge commit of the pull request with that number even while a refresh is out, none for another number, and none when the read fails.
- **Calling a read** - a read gets the project's folder and the input and answers its JSON, nothing as an empty answer; a read that throws answers its message, one that never answers times out; an unknown read, a name every object carries, an input that is not an object or is too large, and a server part that does not load each answer their error.
