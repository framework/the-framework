---
'@gemstack/framework-dashboard': patch
---

The Tickets list grows a plan column (#685). A ticket that already has a `<stem>.plan.md` shows a plan icon that links to a new page rendering the plan's markdown (`/{project}/tickets/{slug}/plan`); a ticket with no plan yet shows a spike button that starts a session with `Create tickets/<stem>.plan.md` to write one. The column replaces the old "planned" badge — the badge stated the fact, the column states it and gives the reader somewhere to go with it. The plan view reads the file through the existing confined `onFileContent` read, so no new server surface is added.
