What the tests cover, against a four-layer chain (the start, the project, the repo file, a global tier) that the mechanism accepts even though only two layers are wired today:

- **Nearest layer wins** - a key is taken from the nearest layer that set it, whichever layer that is, and the winner is named; a nearer explicit `false` beats a farther `true`.
- **Unset is not a vote** - a layer that left a key unset does not shadow a farther layer that set it; no layer setting a key resolves to nothing.
- **Every layer can win, every layer can be absent** - each tier alone can supply a value and is named as its source; with no layer speaking, or no layers at all, vanilla and transparent are off, the handoff is `pr`, and no source is recorded.
- **The repo file as a layer** - it carries only the keys the file set, under the name `the-framework.yml` unless another name is given.
- **The one-line summary** - nothing to narrate yields an empty line; otherwise each configured key is shown with its value and winning layer, such as `transparent=off (run), handoff=local (the-framework.yml)`.
