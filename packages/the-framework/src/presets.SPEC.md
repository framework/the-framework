Materializes the quality presets into a repo: joins the list of materializing preset stems with the preset catalog's templates, and writes each into `<repo>/.the-framework/presets/<stem>.md` so an agent queue entry's file path resolves to a real file the agent can open.

## Business logic — TL;DR

- **One source of truth** - the stem→template map derives from the preset catalog; a stem with no catalog row simply vanishes from the map, which the tests turn into a failure, so the two lists cannot silently disagree.
- **The blank ships unrendered** - each written file keeps its `${{ tf.params.what }}` target blank as-is, because the queue entry pointing at the file tells the agent what to set it to.
- **Overwrites on purpose** - materializing again refreshes the files to the installed framework version; the package ships no preset files into the repo any other way.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
