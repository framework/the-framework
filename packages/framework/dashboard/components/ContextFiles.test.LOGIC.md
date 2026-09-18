What the tests cover, for the list of files picked into the launcher's Context [1]:

- **Nothing to show** - with no files picked, nothing is rendered.
- **Each file by its path** - every picked file is listed by its repository-relative path.
- **Removing a file** - the remove cross of a file, named "Remove <path>", reports that file's full path for removal.

## Glossary

[1] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root.
