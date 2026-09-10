What the tests cover, for the Discord message the interventions feed posts:

- **One pull request** - the message carries the pull request's number, the project's name and the pull request's URL.
- **A parked agent** - the message carries the question's title, "awaiting your answer" and the dashboard link, and no phantom pull request number.
- **Several items, or none** - several items go out as one message headed "N items need you"; an empty batch posts nothing at all.
- **Unpushed work** - the message names what was asked, the commit count, the branch and "never pushed", with no pull request number; a single commit reads "1 commit", not "1 commits".
