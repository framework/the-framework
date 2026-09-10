What the tests cover, over real HTTP against the start queue:

- **Queuing and polling a request** - a request for a repository, a branch and a prompt is accepted with 202 and an id; polled by that id it reads as queued; once the extension has claimed it and reported the cloud session, it reads as created with the session's id and its `https://claude.ai/code/<session id>` URL.
- **The model** - a model named in the request travels to the queue; a request without one queues none; a model that is not a string is 400.
- **A failure travels back** - a request the extension could not fulfil reads as failed with the extension's note.
- **No extension around** - the request is refused with 409 at once, naming the missing browser extension, rather than after a timeout.
- **Token, validation and the bridge switch** - no token and a wrong token are both 401; a repository that is not an owner-and-name slug is 400, as is a body that is not an object; a GET on the queue itself is 405; an unknown id and a path that tries to leave the prefix are both 404; with the bridge off every route is 404.
