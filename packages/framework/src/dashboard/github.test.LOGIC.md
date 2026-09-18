What the tests cover:

- **Normalizing a GitHub remote** - the scp-style form with and without `.git`, the ssh form, the https form with and without `.git`, and an https form carrying a credential and trailing whitespace all become the same `https://github.com/<owner>/<repo>` URL.
- **Refusing what is not a GitHub repository** - a GitLab remote, a remote on another host, a bare `https://github.com/`, an owner with no repository, and an empty remote all resolve to nothing.
- **Reading `origin`** - the URL read takes the `origin` remote from git and answers nothing when git fails (no `origin`).
