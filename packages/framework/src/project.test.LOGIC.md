What the tests cover:

- **Activated means the ignore file exists** - a repository with `.the-framework/.gitignore` is activated; without that file it is not, so a bare `.the-framework/` directory is not activation.
- **The files git sees** - the listing asks git for tracked and untracked files honoring the ignore rules, in the repository given; the paths come back sorted, a path listed twice appears once, the trailing empty entry of git's output is dropped, and a git failure such as "not a git repository" lists nothing.
