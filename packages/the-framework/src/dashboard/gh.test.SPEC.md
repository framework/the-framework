Covers the GitHub adapter: token resolution (environment first, then the existing login, blanks never counting), the merge ladder (auto-merge, draft-ready retry, direct fallback only on the known refusals, watch mode deferring to CI rather than merging early), CI verdicts where an unreadable status is never green, the open-PR list reporting a gh that could not answer instead of calling it an empty queue, and the repo's auto-merge setting read as on, off, or unknown.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
