What the tests cover:

- **Nothing recorded** - a project with no error lists none.
- **A recorded error** - carries its kind, its message and when it was first recorded.
- **Re-reporting keeps the first time** - a second report of the same kind replaces the message and keeps the original time, so a banner shows how long the project has actually been stranded.
- **Clearing** - removes the error; clearing what was never recorded does nothing; a report after a clear starts its own clock.
- **Per project** - an error recorded on one project is not listed on another.
