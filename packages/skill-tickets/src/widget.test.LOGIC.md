What the tests cover, on the widget's rules alone:

- **The prompts** - the plan ask, the work ask and the plan's path are each made from the ticket's filename in the one wording.
- **The run behind a plan and a claim** - the newest run whose ask contains the plan ask is the plan's author, a run that named another ticket is not, and a ticket nobody named has none; a claim's run is the one with the holder's id, and any other holder has none.
- **The widget's address** - no segment is the list; a project and a ticket's filename is the ticket; `plan` after them is its plan; a project alone, a name leaving `tickets/`, a plan's filename, another third word or a fourth segment name no page.
- **A ticket as a link** - its title pointing at its file at its own priority, 5 when it names none; a plan ask points nowhere at the same priority.
- **Reading the command's answers** - `list` keeps only rows with the five plain facts and reports an output that is not a list or a command that could not run; `show` reads the ticket with its plan and holder, reads a refusal as no ticket, and reports an answer without the ticket's text; `meta` reads the stamp and nothing on any failure.
- **A ticket's lane on the Overview card** - a claimed ticket is claimed whatever its priority; an unclaimed one is high priority from 7 up and in no lane below; `0`, a word and no priority are in no lane; a priority with spaces around it still reads.
- **Held back from work** - a `PR:` line reads as in review, a `Waiting:` line as waiting, in review first when both, an empty `Waiting:` as nothing; a ticket in review is in no lane of the Overview card whatever its priority, unless claimed; a waiting one is in the "Waiting" lane at any priority, in review or not, unless claimed.
