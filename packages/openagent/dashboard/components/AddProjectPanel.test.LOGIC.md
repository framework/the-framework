What the tests cover, for the "Add project" modal:

- **Picking is the form** - the system folder dialog is asked for the moment the modal opens; the picked path is shown back for the trust confirmation, what the add will do to the folder is said on that step ("makes no commit on your branch and pushes nothing", "Your files and your branch stay as they are."), and nothing is registered until "I trust it, add it" is pressed, after which "Project added" is shown and that path is registered, with the agents' records kept on this machine since the user picked nothing else.
- **Where the agents' records go** - the trust step shows two choices, "Keep them on this machine" picked and "Share them to the repository's remote" not, each with what it does beside it ("Nothing is pushed.", "…keeps pushing as agents work"); picking sharing and confirming adds the project with that answer, and nothing about a missing remote is shown.
- **Sharing picked, no remote** - when the daemon answers that the repository has no remote, "Project added" is followed by "This repository has no remote, so the agents' records stay on this machine."
- **A folder handed in** - the modal shows that folder at once and never asks for the system dialog; there is no "Choose again", "Cancel" closes the modal without adding, and "I trust it, add it" adds that folder with the records kept on this machine.
- **Already a project** - a repository that was already a project reads "Already added".
- **Dismissing the system dialog** - closes the modal without adding anything.
- **A dialog that could not open** - the daemon's reason is shown, and "Try again" asks the daemon again.
- **A refused add** - the daemon's reason is shown and the trust step stays, with "I trust it, add it" still offered.
- **"Choose again"** - reopens the system dialog from the trust step and shows the newly picked path.
