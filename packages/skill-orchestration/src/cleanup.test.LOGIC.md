What the tests cover, against a real repository with a real remote:

- **Everything of the package's goes** - after settings were saved, the clean-up answers `removed: [".orchestration"]` with nothing kept: the directory is gone, the exclude file names it no more, and the remote's branches, every local branch and the working tree are as they were; a second clean-up removes nothing and keeps nothing; with a half-written settings file left beside the settings by a killed save, both go and the directory with them.
- **The person's file stays** - with a file of the person's own in the directory, the settings file goes and is named, the person's file is kept with `not made by orchestration` and reads as it did, and the rule hiding the directory is still in the exclude file.
- **The command** - `orchestration cleanup` exits 0 with `{"ok":true,"removed":[".orchestration"],"kept":[]}` on stdout and nothing on stderr.
