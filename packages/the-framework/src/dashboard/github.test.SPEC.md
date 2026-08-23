What the tests cover: every common spelling of a GitHub `origin` remote — the short `git@github.com:` form, the full `ssh://` form and `https://`, with or without a `.git` suffix, with an embedded credential, and with trailing whitespace — resolves to the same browsable repository address and to the same owner-and-name pair. Remotes on other hosts, and GitHub addresses that do not name both an owner and a repository, yield no answer, as does a checkout whose `origin` remote cannot be read.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
