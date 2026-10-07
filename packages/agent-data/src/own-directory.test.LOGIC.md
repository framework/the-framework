What the tests cover, against a real repository:

- **Everything of the tool's goes** - with the tool's two files in its directory and the rule hiding it, the answer is `removed: [".tool"]` with nothing kept: the directory is gone, only the tool's line left the exclude file (a person's own lines stay), the working tree is clean, and a second pass removes nothing and keeps nothing.
- **What the tool did not name stays** - with a file of the person's own and a directory beside the tool's files, the two files go and are named one by one, the other two are kept with `not made by the-tool`, the person's file reads as it did, and the rule hiding the directory is still in the exclude file.
- **Tracked files and wrong kinds** - a named file git tracks is kept with `git tracks it` and reads as it did; a directory under a named file's name is kept with `not made by the-tool`; nothing is named in `removed` and the working tree stays clean.
- **A link, and no directory** - in a project with no such directory a rule written by hand stays and the answer is empty; a link in the directory's place is kept with `not made by the-tool`, and the file it leads to reads as it did.
- **The rule is the repository's** - with a second checkout of the same repository holding its own directory, the pass removes this project's directory and leaves the rule, and the other checkout's status stays clean.
