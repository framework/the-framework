What the tests cover:

- **A baseline, then only what is new** - the first read seeds the baseline and announces nothing; an item that appears on a later read is announced alone; a read with nothing new announces nothing.
- **Identity is the caller's** - with the activity feed's identity, an agent starting and the same agent finishing are two separate announcements, each made once.
- **Reading nothing whole is no baseline** - a first read that succeeds with an empty list because nothing could be read whole earns no baseline, so the first real read's pre-existing items are not announced.
- **Per-project baselines** - one unreadable project neither floods nor silences the others: the readable project keeps announcing new items while the other is unreadable, and the unreadable project's pre-existing items are not news on its first whole read.
- **A partial read is remembered** - an item seen while its project was not read whole is not announced once the project is read whole.
