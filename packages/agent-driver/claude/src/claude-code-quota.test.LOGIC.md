What the tests cover, against a real Claude Code usage readout:

- **Reading the windows** - the session window, the week across all models and one model's own week come off a real readout with their labels, kinds, percentages and reset phrases; the breakdown lines that only look like windows are ignored; a fractional percentage is kept; a window printed without a reset phrase carries none.
- **An account burning overage** - the overage header still reads, and the window it prints keeps its relative reset phrase.
- **An empty reading names its reason** - a readout with the subscription header but no readable window is unrecognized; a readout without the header means no subscription; an empty readout is unavailable, never zero use.
- **Which reasons are transient** - a failed fetch, a timeout and an unrecognized readout are transient; no subscription and a missing coding agent describe the setup.
- **Asking Claude Code** - the reading runs Claude Code's own usage command in print mode with JSON output, never in bare mode, and opens the JSON envelope for the readout.
- **Failures of the attempt** - an envelope flagged as an error and a non-zero exit are failed fetches; output that is not JSON is unrecognized; a command that cannot be started is a missing coding agent; a command that never answers gives up on the timeout.
