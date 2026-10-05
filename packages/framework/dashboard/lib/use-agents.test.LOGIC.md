What the tests cover:

- **Nothing is read without a project** - with no project selected the daemon is never asked and the list stays empty.
- **Polling** - the selected project's agents are read at once and re-read every 2 seconds, so a change shows up without a reload.
- **Refreshing on demand** - an immediate refresh shows an agent that has just started without waiting for the next poll.
- **Switching project** - the previous project's agents are cleared while the new project's list loads, rather than being shown under the new project.
- **A refresh that outlives its project** - an in-flight refresh for the previous project never writes its agents into the new project's list once it lands.
- **A read that fails** - the last list stays on screen instead of emptying, and the failure surfaces nowhere.
- **An agent just started** - the list is read every 400 milliseconds while the agent is not in the list, and while it is in the list as running with no branch on its card; once the card names the branch, the reads are back to one every 2 seconds.
- **An agent that ended without a branch** - an agent just started whose card says it failed and names no branch is not read more often.
- **30 seconds at most** - for an agent just started that stays running and never names a branch, the quicker reads stop after 30 seconds, and the list is read every 2 seconds again.
- **No agent just started** - with none named, nothing is read more often than every 2 seconds.
