What the tests cover:

- **Nothing to show, nothing rendered** - with no open question there is no section and no heading.
- **What a row says** - under the heading "Waiting on you · 1", a row reads, in this order: "Needs input", the agent's title, the question's title, the project's name, how long ago ("12m ago"), and ends on the arrow.
- **Naming a row** - an agent is named by the first line of its intent, and by its id when it has no intent; the row's button is named "Open <that title>: needs input, <the question's title>".
- **No time** - a question with no time shows nothing about when.
- **Order** - rows come in the order the daemon gives.
- **Into the agent** - a click on a row opens that row's agent in that row's project, and no other.
- **One project's questions** - given a project, the section shows and counts only that project's questions, and is absent when that project has none while another has.
- **No answering** - the list has one button per row and nothing else: no option, no "Submit", no "Skip"; a click sends no pick and no message.
- **A row holds still** - when the next read brings another question from the same agent, the row is the same row with the new question's title.
