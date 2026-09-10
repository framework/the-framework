What the tests cover:

- **An unmarked repository is ungated** - a repository without a `LAYOUT` marker passes the check.
- **A matching marker passes** - a marker equal to what this build writes passes.
- **A mismatched marker refuses** - a marker recording another layout (a runs directory named `sessions` where the build uses `agents`) is refused with a message that names `.the-framework/LAYOUT`, both layouts, the cause, and the fix ("update").
- **The marker is pure data derived from the build** - every line of the marker is one `name: value` pair with no comment, and the marker lives at `.the-framework/LAYOUT` under the project.
- **The repository's own marker is pinned** - the `LAYOUT` file checked into this repository equals what the build derives, so a pull request renaming a layout name fails until the file is regenerated; outside the repository's checkout (an installed package) there is nothing to pin.
