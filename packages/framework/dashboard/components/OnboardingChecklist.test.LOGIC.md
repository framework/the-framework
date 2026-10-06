What the tests cover:

- **Optional versus essential** - two steps carry the "Optional" badge; "Add a project" and "Populate the queue of AI tasks" do not, while "Populate tickets/" does.
- **The queue step needs a queue** - with no registered project having a queue, the step is not on the board.
- **The tickets step needs a tickets package** - with no registered project providing tickets, "Populate tickets/" is not on the board.
- **Checkboxes, not radio buttons** - an open step is drawn as an empty square named "Not done", never as a circle.
- **The tickets import lands on its agent** - "Update tickets" starts an agent on the target project with the `/update-tickets` command, and then navigates with the project, the prompt and the started agent's id.
- **A refused start** - the refusal's reason ("already active") is shown and the user is moved nowhere.
- **Configure first** - the chevron's "Configure first, then run" opens the target project's launcher, starts nothing, and leaves the update-tickets prompt as the pending draft.
- **"Add <folder> as project…" asks first** - with the daemon's folder not yet a project, the button adds nothing itself: it opens the "Add project" dialog on that folder, with no system folder dialog and "Keep them on this machine" picked; the project is added, with the records kept, only on "I trust it, add it".
- **What adding does, said first** - with no project yet, the first step shows what adding a project does to the folder ("makes no commit on your branch and pushes nothing", the empty first commit) before anything is pressed, and nothing is added; with a project registered it shows only the sentence on what a project is.
- **A folder that is already a project** - is not offered again: no "… as project" button.
- **No project yet** - there is no "Update tickets" to press: no project provides tickets.
