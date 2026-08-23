What the tests cover: how the `/tickets` page's filtering, sorting and shareable-URL behaviour works out in practice.

- **Pooling** - every project's tickets become one cross-project list, each entry remembering which project it came from.
- **Search** - case-insensitive, matching across title, summary, filename and topics; every typed word must land somewhere; a blank search hides nothing.
- **Numeric facets** - a band selects its span, "unset" selects the tickets naming no value, and the two combine; an exact minimum-maximum span is inclusive at both ends and never admits a ticket with no value; picking a band clears any exact span and vice versa, while "unset" survives both.
- **Stage** - unplanned and planned split on whether the ticket has a plan, claimed follows the `.lock.md` and composes with planned instead of excluding it; picking several stages widens the result.
- **Topics, project and GitHub link** - topics match case-insensitively so `UX` and `ux` are one, "no topics" selects the topicless, the project facet narrows by membership, and the GitHub toggle keeps only locally written tickets.
- **Sorting** - a ticket missing the sorted value lands last in both directions, ties fall back to newest first, and each sort key starts in its own natural direction.
- **Band-to-slider mirroring** - adjacent bands collapse into one span, while a selection that skips a middle band cannot and reports none.
- **Facet counts** - each option is counted with the other facets applied but its own facet ignored, so a selected topic and the unselected ones both stay pickable; stage, GitHub-link and "unset" counts follow the same rule.
- **The URL codec** - the untouched view is an empty query string; a fully loaded view survives a round trip; junk parameters, unknown bands, impossible spans and unknown sort keys are ignored rather than rejected; a sort key at its natural direction omits the direction while a flipped one records it; and "any filter active" reacts to filters only, never to sorting or grouping.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
