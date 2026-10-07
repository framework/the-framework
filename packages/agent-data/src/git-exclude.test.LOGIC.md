What the tests cover, against the exclude file of a real repository:

- **Written once** - a rule added twice, after a person's own lines, is in the file once, and a second rule lands on its own line after it.
- **Taken back out** - taking a rule out answers true and removes only the line that is exactly the rule: the person's comment, the person's own rule and the other tool's rule read as they did; taking out a rule that is not there, or one that is only part of a line, answers false and leaves the file as it was.
- **No exclude file** - in a repository with no exclude file, taking a rule out answers false and creates no file.
