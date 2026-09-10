What the tests cover, for the "Add project" modal:

- **Picking is the form** - the system folder dialog is asked for the moment the modal opens; the picked path is shown back for the trust confirmation, and nothing is registered until "I trust it, add it" is pressed, after which "Project added" is shown and that path is registered.
- **Already a project** - a repository that was already a project reads "Already added".
- **Dismissing the system dialog** - closes the modal without adding anything.
- **A dialog that could not open** - the daemon's reason is shown, and "Try again" asks the daemon again.
- **A refused add** - the daemon's reason is shown and the trust step stays, with "I trust it, add it" still offered.
- **"Choose again"** - reopens the system dialog from the trust step and shows the newly picked path.
