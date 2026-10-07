What the tests cover:

- **What a project is offered** - a project with a git host provider is offered all five options of the publish menu, in order: `nothing`, `commit`, `branch`, `pr`, `merge`; a project with none is offered `nothing`, `commit` and `branch` only.
- **The option in force** - with none saved it is "Commit", with or without a git host provider; a saved "Nothing", "Commit" or "Merge on green" is in force in a project with a git host provider; in a project with none, a saved "Open PR" or "Merge on green" is "Publish branch", and a saved "Publish branch" or "Nothing" stays as it is.
- **The level an option hands over** - "Nothing" hands the start hook no publish level; "Commit", "Publish branch", "Open PR" and "Merge on green" hand `commit`, `branch`, `pr` and `merge`.
- **No remote** - a project with no remote is offered Nothing and Commit, with or without a git host; a saved "Publish branch" or "Merge on green" is Commit there, and so is no saved pick, while a saved Nothing stays Nothing; with a remote the fallback for a saved pick is the branch.
