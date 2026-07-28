The files picked into the run Context (#661), listed with an X to remove each.

## TLDR

- Files reach the Context two ways — a `#` mention in the prompt (#504) and the right-rail file tree — both adding the same relative path to the shared context set; without this list they were invisible once the prompt was cleared.
- `onRemove(path)` also unticks the file tree (the caller shares the set); renders nothing when empty.
