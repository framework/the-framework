What the tests cover: every command of the command line against real git, from clones acting as agents that share one origin, and the contract around them.

- **Reads** - the bare command gives the open entries in order of work, read off origin, from a clone holding no checkout of the branch; another clone reads every push, this one's included.
- **`add`** - an entry lands in the section its priority names; with no priority it goes at the end; the file that results is the sections in order, high to low; each write is one commit named after what it did, authored by the agent's own clone; with no queue file on the branch yet, the first `add` creates it.
- **Nothing lands locally** - the agent's clone gains no copy of the branch and no change in its own working tree.
- **`done`** - the line is deleted rather than checked off, as one commit; an entry that is not open is refused as no such entry, on stdout and in one line on stderr.
- **Usage** - an unknown command, a bare command given an argument, an argument missing or extra, an empty entry and a priority off the scale or not a number all get the usage on stderr, no JSON, and exit code 2, and write nothing.
- **A repository with no remote** - reads come off its local copy of the branch, and every write is refused because nothing can carry it.
- **Outside a repository** - refused as such.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
