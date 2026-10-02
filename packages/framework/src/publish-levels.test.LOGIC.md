What the tests cover:

- **What a project is offered** - a project with a git host provider is offered all four options of the publish menu, in order: `nothing`, `branch`, `pr`, `merge`; a project with none is offered `nothing` and `branch` only.
- **The option in force** - with none saved it is "Nothing"; a saved "Merge on green" is in force in a project with a git host provider; in a project with none, a saved "Open PR" or "Merge on green" is "Publish branch", and a saved "Publish branch" or "Nothing" stays as it is.
- **The level an option hands over** - "Nothing" hands the start hook no publish level; "Publish branch", "Open PR" and "Merge on green" hand `branch`, `pr` and `merge`.
