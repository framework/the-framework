What the tests cover, on the widget's rules alone, with a stand-in for the command:

- **How an entry reads** - a leading link to a ticket reads as its title with nothing to open and its trailing note dropped; a leading link to an absolute URL reads as its title and opens it; plain text reads trimmed; a link further into a sentence is not a title.
- **What a link is queued as** - a link with a target becomes `[text](href)`, one without stays plain; the command line carries `--priority N` only when a priority was given, priority 0 included.
- **Queueing a batch** - one `add` per link in the order given; a command that cannot run stops the batch there with its error and the later links are never tried; a refusal answered by the command stops it with "the queue refused: <reason>", or "the queue refused" without one; an empty batch is done.
