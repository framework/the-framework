What the tests cover, with the card rendered inside a fake dashboard host and no other widget mounted:

- **The read** - every project that has the package is read with `queue --local`; a project with no entry is left off; a project whose command fails is named with the command's reason while the others show; "Nothing queued." when no project has an entry.
- **Independence** - with no other widget installed, a queued ticket reads as its title and points nowhere, and a queued absolute URL opens it: the card names no tickets package.
- **Starting one entry** - the play button starts one run in the entry's project with the one-entry prompt, landing on it.
- **The fan-out** - the count typed beside a project sets how many runs start, one per entry from the top of the queue in order, each with its own entry's prompt, none landing; the label is capped at the entries there are; the batch stops at the first refusal and shows its reason.
- **Configure first** - the chevron hands the entry's prompt to the project's launcher and starts nothing.
