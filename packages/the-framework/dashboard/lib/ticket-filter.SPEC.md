The tickets page's filtering, sorting, and grouping model: every project's backlog as one pool, narrowed instantly in the browser, with the whole view carried by the URL so it can be shared, reloaded, and returned to.

## Flows

- The facets: word search, priority/effort/uncertainty, topics, pipeline stage (unplanned / planned / claimed by an agent), project, and locally-written-only. Selections OR within a facet and AND across facets.
- A numeric facet takes named buckets or a fine range — two ways to say the same thing, so picking one clears the other. The "no value" option composes with either, so tickets naming no value can be included alongside any selection.
- Every facet option shows how many tickets it would reveal under all the other filters, its own facet ignored, so options don't all collapse to zero the moment one is picked.
- Sorting puts tickets with no value last in both directions, breaks ties newest-first, and starts each key in its natural direction; sort and grouping reorder but never hide, so they don't count as filters.
- A hand-typed URL is input: junk is ignored, and defaults are omitted so the bare page keeps a bare address.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
