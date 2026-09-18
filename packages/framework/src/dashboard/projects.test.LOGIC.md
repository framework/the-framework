What the tests cover:

- **A project's summary** - the display name is the last segment of the project's path, and the id and path are carried as registered; the last activity is the newest among the project's agents; a project with no agents carries no last activity at all; whether the project is activated follows the marker check.
- **Forgiving reads** - a failing marker check reads as not activated and a failing agents read as no activity, without the summary failing.
- **Only projects on disk are listed** - a registered project whose directory is gone is not listed and its id resolves to no path, while a present one lists and resolves; the registration survives the absence, so when the directory is back the project is listed again; a failing directory check reads as gone and never fails the list.
