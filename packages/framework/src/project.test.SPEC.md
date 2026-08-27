What the tests cover:

- **Activation** - a project counts as activated only when the `.the-framework/.gitignore` file installation writes is present; a `.the-framework/` directory without it does not count.
- **The repo file crawl** - the crawl asks git for tracked and untracked files while honoring the repo's ignore rules, and reports repo-relative paths de-duplicated and sorted; a path listed twice appears once, and any git failure yields no files instead of an error.
## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
