Where a link into a project's files opens. A queued entry, or any page's link, may point at a path inside the project's repository, such as `tickets/2026-01-01_x.md`. The dashboard has no page of its own for such a path: the page is a module's [1], if an installed package brings one, and the dashboard names no module. The convention: the path's first segment names the page, and the page gets the project and the rest of the path as its own segments.

## Context

**User story**: the user clicks a queued ticket's title on the Overview and lands on that ticket's page, `/tickets/<project id>/2026-01-01_x.md`, brought by the tickets package; in a dashboard where no project has that package, the same title is plain text.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic

A link's target is split on `/`. It names a page when it is not an absolute URL, does not start with `/`, its first segment is a page word (a lowercase letter, then lowercase letters and digits) and something follows the segment; `tickets/a.md` gives the page `tickets` and the rest `['a.md']`, while `README.md`, `/tickets/a.md`, `Tickets/a.md` and `https://…` name none. When one of the mounted module pages carries that word, the link opens that page at `/<word>/<project id>/<rest…>`, so the page receives `[projectId, ...rest]` as its path; when none does, the link opens nothing, and the page that shows it shows text.
