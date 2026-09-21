What the tests cover, for what an agent left behind as shown in the agent's action bar and the detail it expands to:

- **The verdict and the lists** - a finished agent with one commit and one file reads "1 commit" and "1 file" in the bar, and, expanded, lists the commit's subject and the file's path; collapsed, the verdict stays and the lists are gone; the branch name is never repeated in either.
- **The next step is never behind the disclosure** - "Open PR" is offered with the bar collapsed.
- **Nothing changed** - a branch with no commits reads "no changes", cannot be expanded, offers no "Open PR", and says "Nothing committed — no PR to open.".
- **Merged is not empty** - a branch whose commits all landed on the base reads "merged", never "no changes".
- **Uncommitted work is named, never a button** - an empty branch with uncommitted files says "Nothing committed — index.html, src/app.ts left uncommitted." with no "Open PR", and the expanded detail lists them under "Uncommitted files"; past two files the rest are counted ("a.ts, b.ts and 2 more") and the hover carries every path.
- **A gone branch** - reads "branch gone", offers no "Open PR", and says "Branch gone — nothing to open a PR from.".
- **One button, and it opens the pull request** - "Open PR" is offered whether or not the branch is pushed, never a separate "Push branch"; pressing it opens the pull request and never pushes on its own.
- **A failed action says why** - when opening the pull request fails, its reason (such as "gh: not logged in") is shown instead of nothing happening.
- **An open pull request becomes the merge** - with an open, unmerged pull request, neither "Open PR" nor "Push branch" is offered, and "Merge PR" merges it.
- **A landed pull request offers nothing** - a merged or closed pull request offers neither "Merge PR" nor "Open PR".
- **No git host package** - a project with no git host package offers "Push" and no "Open PR"; pressing it pushes the branch; once the branch is pushed the bar says "Pushed — no git host package to open a pull request with." and offers nothing.
- **No remote** - a repository without a remote says "No remote to push to" and offers no push.
- **Nothing before the first read** - until the branch read answers, nothing at all is rendered, so no wrong empty state flashes.
