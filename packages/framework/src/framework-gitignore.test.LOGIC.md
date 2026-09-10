What the tests cover, against a real git repository:

- **Everything under `.the-framework/` is transient** - with the ignore file in place, an agent's live event stream, the archive under `agents/` and a checkout directory placed under it are all invisible to git, while the ignore file itself is the one thing git offers to track.
