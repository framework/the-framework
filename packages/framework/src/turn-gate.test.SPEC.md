What the tests cover: reading the signals an agent writes into a turn's final message — the question it stopped on, and the non-blocking signals it reports alongside its work.

- **The gate** - a turn that just finished carries no question. A well-formed question yields its title, its options with their labels and details, and the recommended option — named either by option id or by option label. Missing option ids are filled in from position, a blank title falls back to a generic one, and a single-pick question carries no multi-select marking at all rather than an explicit "no".
- **One shape for every question** - a multi-select question says so and remembers which options start checked; a plan approval is an ordinary two-option question that additionally names the file under review, and a question about no file names none; an option can declare that picking it ends the agent instead of resuming it.
- **Forgiving parsing** - the last question in a turn wins, but a malformed last one falls back to a good earlier one. Invalid JSON, a non-object body, an empty option list, options that all lack labels, and a body with no options at all are each simply not a question — nothing is thrown and the agent carries on.
- **Views** - a turn with no view block yields none. A view's first heading is its title and the rest is its body; a view with no heading is titled "Note"; an empty view is skipped. Several views in one turn are all kept, except that a repeated title collapses to the later one.
- **A heading with no usable characters** - a markdown view whose heading reduces to nothing still gets the fallback id.
- **Ready for merge** - reported only when the turn carries the block, with or without a body.
- **Pull request** - the block reads like a commit message: first line the title, everything below it the description, with the description's markdown kept whole. A one-line block is a title alone. A first line too long to be a name for the work is taken as description only, never cut to fit, so a truncated sentence cannot become the permanent commit subject. The last block wins so the agent can revise it, an empty block is ignored rather than blanking what came before, and a turn with no block asks for nothing.
- **Errors** - a turn with no error block reports none. An error's first line is its headline and the rest is its detail; a one-line block is a headline alone; an empty block is not an error. Every error block in a turn is kept, in order, because two things going wrong is two errors.
- **Reporting each signal once** - across consecutive turns, an error the agent restates verbatim is reported once, while a second failure with different detail is reported as its own error.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
