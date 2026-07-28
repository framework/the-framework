Derives a repo's github.com URL / `{owner, repo}` slug from its `origin` remote, for the panel's "Open on GitHub" link (#489/#488) and slug-needing callers (#1050).

## Facts

- `githubUrlFromRemote` normalizes the scp-style (`git@github.com:o/r.git`), ssh, and https forms — dropping `.git`, embedded credentials, and trailing slash — and validates the slug is exactly `owner/repo`; non-GitHub remotes yield undefined.
- Safe anywhere: the relay has no local checkout, so `githubUrlFor`/`githubSlugFor` resolve to nothing there.
