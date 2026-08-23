What the tests cover: creating the data branch, writing to it, and keeping it in step with other machines — against real git repositories, a real remote, and a second clone standing in for another machine.

Creating it: the branch is born with no commit in common with the project's code history, is checked out, has its agent queue file seeded empty, and gets a relative `tickets` link at the repository root so a moved repository keeps working. That link is hidden from git, so no sweeping commit can carry it onto a code branch — while the data checkout's own tickets directory stays committable, which is the branch's whole cargo. Creating it twice changes nothing and still succeeds. A `tickets` path the user already had is left exactly as it was, and stays visible to git as theirs. When the remote already has the branch, that branch is adopted rather than a second history being born.

Writing to it: a write commits on the data branch, pushes it, leaves the code branch untouched, and records the caller's own message so the data history narrates itself. A change that writes nothing commits nothing. In a repository with no remote the write still lands locally and reports that it was not pushed.

Converging with others: a write pulls in what another machine pushed and carries out a commit an earlier failed cycle had stranded locally, so all three histories end up on the remote. When a stranded local commit conflicts with what the remote has, the remote's version wins and the change is re-applied on top of it — so an append lands on the remote's content, not on the stale local copy. The scheduled pull alone converges a machine on what others pushed.

Concurrency: writes issued at the same time run strictly one after another rather than interleaving, so every one of their changes survives.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
