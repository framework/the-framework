What the tests cover:

- **Normalizing a GitHub remote** - the scp-style form with and without `.git`, the ssh form, the https form with and without `.git`, and an https form carrying a credential and trailing whitespace all become the same `https://github.com/<owner>/<repo>` URL.
- **Refusing what is not a GitHub repository** - a GitLab remote, a remote on another host, a bare `https://github.com/`, an owner with no repository, and an empty remote all resolve to nothing.
- **Owner and repository name** - a GitHub remote splits into its owner and repository name; a non-GitHub remote or an owner-only URL yields nothing.
- **Reading `origin`** - both the URL read and the owner-and-name read take the `origin` remote from git and answer nothing when git fails (no `origin`).
