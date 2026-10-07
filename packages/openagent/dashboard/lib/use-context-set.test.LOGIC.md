What the tests cover, for turning the prompt and the Context [1] into the prompt a Start sends:

- **No Context** - the prompt is returned exactly as typed, trailing space included.
- **A Context** - the prompt's trailing whitespace is trimmed and one `Context: <paths joined by ", ">` line follows after a blank line, so a command's `/<command>` still leads the prompt.

## Glossary

[1] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root.
