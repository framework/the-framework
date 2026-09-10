What the tests cover:

- **Nothing is read without a project** - with no project selected the daemon is never asked and the list stays empty.
- **Polling** - the selected project's agents are read at once and re-read every 2 seconds, so a change shows up without a reload.
- **Refreshing on demand** - an immediate refresh shows an agent that has just started without waiting for the next poll.
- **Switching project** - the previous project's agents are cleared while the new project's list loads, rather than being shown under the new project.
- **A refresh that outlives its project** - an in-flight refresh for the previous project never writes its agents into the new project's list once it lands.
- **A read that fails** - the last list stays on screen instead of emptying, and the failure surfaces nowhere.
