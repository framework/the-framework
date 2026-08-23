Reads the files out of a zip archive, so an agent that ran on the `actions` run target can have its transcript recovered: GitHub only hands back a workflow run's uploaded artifact as a zip, and that download is the sole way to read what happened on a GitHub Actions runner. Only the shapes GitHub's artifact upload produces are supported — stored or deflated files, no encryption. Anything unrecognized is reported as a failure instead of yielding a partial archive, because a silently truncated transcript would read as an agent that said less than it actually did.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
