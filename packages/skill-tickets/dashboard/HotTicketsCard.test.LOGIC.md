What the tests cover, with the card rendered inside a fake dashboard host:

- **The two lanes** - every project's tickets are pooled: a claimed ticket lands in "Claimed" with its holder whatever its priority, an unclaimed ticket at 7 or up in "High priority", a lower one is off the card; every project is read with `tickets list --local` and asked for its runs; with several projects each row names its project.
- **A row** - the title opens the ticket's page in this widget; a claim held by one of the project's runs shows the run's name and opens the run.
- **Independence** - with no other widget installed the rows offer nothing on the ticket; with a link action mounted for the project, each row offers it, and a click hands the action the ticket as a link (title, `tickets/<file>`, priority) in the ticket's project, then reads as done.
- **Empty and failed** - "Nothing claimed or high priority." when nothing qualifies; a project whose command fails is named with the command's reason while the others show.
