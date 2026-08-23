What the tests cover: which items a poll announces, and which it deliberately keeps quiet about.

- **First read is a baseline** - the items already there when the daemon starts are recorded and announced to nobody; an item appearing on a later poll is announced, once, and not again on the polls after it.
- **Identity is the caller's** - the same agent starting and later finishing counts as two separate announcements, because the watched list says what makes two items the same.
- **Failures announce nothing and earn nothing** - a poll that could not list the projects, or could not build the list, announces nothing; and it does not count as the baseline, so the first successful poll afterwards still keeps the pre-existing backlog quiet.
- **A successful but empty poll is not a baseline either** - a start-up with no reach to GitHub produces an empty list rather than a failure, because the reads underneath forgive their own failures; that empty result earns no baseline, so when reach returns the pre-existing items are still not announced as new.
- **The baseline is per project** - one project that cannot be read neither floods the user when it finally answers (its pre-existing items are its own first whole read) nor silences the projects that can be read, which keep announcing their new items throughout.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
