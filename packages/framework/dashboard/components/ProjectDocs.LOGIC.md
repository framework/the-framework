The "Docs" section of the project home [1]: the project's workspace docs (its `PLAN` and `TODO` documents), re-read from the daemon every 4 seconds and shown in the same presentation as the right rail's docs panel (`DocsPanel.tsx`). A project with no docs gets no section at all, not an empty one: the section is earned by content. The section caps its own height, so a long plan scrolls inside it instead of taking over the page's column.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
