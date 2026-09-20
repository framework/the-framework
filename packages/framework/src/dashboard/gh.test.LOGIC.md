What the tests cover:

- **The linked pull request read** - the read asks `gh` for every field it keeps (number, URL, state, title, creation time, head commit); the creation time and head commit come back as answered; a field `gh` did not answer with is absent rather than present but empty.
- **A checkout's open pull requests** - a `gh` that could not answer fails the read instead of answering an empty list; when `gh` answers, the open pull requests are listed.
