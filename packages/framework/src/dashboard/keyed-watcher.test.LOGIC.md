What the tests cover:

- **A baseline, then only what is new** - the first poll seeds the baseline and announces nothing; an item that appears on a later poll is announced alone; a poll with nothing new announces nothing.
- **Identity is the caller's** - with the activity feed's identity, an agent starting and the same agent finishing are two separate announcements, each made once.
- **Announcing after the first poll** - driven poll by poll, the watcher announces only items that appear after its first poll.
- **Failures earn no baseline** - a failing project scan or projection announces nothing; a failed first poll does not seed the baseline, so the first real read stays silent about pre-existing items and the poll after it stays silent too.
- **Reading nothing whole is no baseline** - a first poll that succeeds with an empty list because nothing could be read whole earns no baseline, so the first real read's pre-existing items are not announced.
- **Per-project baselines** - one unreadable project neither floods nor silences the others: the readable project keeps its baseline while the other is unreadable, the unreadable project's pre-existing items are not news on its first whole read, and a readable project keeps announcing new items while another project never answers.
