What the tests cover: the add-project dialog's flow from the OS folder picker to a registered project.

- The system picker is asked for the folder as soon as the dialog opens, the picked path is shown back on the trust step, and nothing is registered until "I trust it, add it" — then exactly that path is added.
- A repo that was already a project reads "Already added" instead of "Project added".
- Dismissing the system picker closes the dialog without registering anything.
- A picker that could not open shows its reason, and "Try again" asks the system for the folder again.
- A failed add shows the daemon's reason and stays on the trust step.
- "Choose again" on the trust step reopens the system picker, and the new choice replaces the old one.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
