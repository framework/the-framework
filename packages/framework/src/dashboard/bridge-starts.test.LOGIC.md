What the tests cover:

- **What a queued request carries** - an accepted request keeps its repository, branch and prompt and starts queued; a model the agent named travels along trimmed, a blank model is dropped, and a model over 100 characters is refused.
- **The repository is `owner/name` or nothing** - a single segment, three segments, a traversal made of dots in either segment, a dot-slash prefix, a name carrying shell syntax and an empty value are all refused, while a repository name that merely begins with a dot (`owner/.github`) passes.
- **The branch must be a git branch name** - a name with a space, one carrying shell syntax or command substitution, an empty one and a 300-character one are refused; an agent's hand-off ref passes.
- **The prompt** - a blank prompt and one over 200,000 characters are refused; a 50,000-character prompt, the size a whole hand-off prompt reaches, is accepted.
- **Claiming** - claims hand out requests oldest first, each once, and nothing once the queue is empty; a claim younger than 90 seconds is honored and the request withheld from a second asker; once the claim expires the request is offered again.
- **The extension's report** - a success records the request as created with the session id and its `https://claude.ai/code/<session id>` link; a success naming no session id is recorded as a failure; a report on a request that was never claimed, or on an unknown id, is ignored and the request stays queued; a failure keeps the extension's note.
- **One queue** - the daemon's queue is a single shared instance, listable, and resettable for tests.
