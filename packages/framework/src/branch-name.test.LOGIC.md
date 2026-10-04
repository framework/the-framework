What the tests cover, each name also asked of `git check-ref-format --branch` so the rule stays git's (except `HEAD` and `@`, which git reads as the current commit and not as a branch's name):

- **Names that are taken** - a plain name, one with dashes, with a slash, with a dot, with `#`, with `@`, in another alphabet, and one 255 characters long.
- **A word a command line could read as an option** - `-b`, `--upload-pack=x` and `-` are refused.
- **What git refuses** - the empty word, `HEAD`, `@`, a space, a tab, a line break, a delete character, `..`, each of `~ ^ : ? * [ \`, `@{`, a leading or trailing slash, two slashes in a row, a part that starts with `.` or ends with `.lock`, a trailing `.`, and a name 256 characters long are refused; so is anything that is not text.
