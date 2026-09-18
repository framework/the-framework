What the tests cover, against a real git repository:

- **Everything under `.the-framework/` is transient** - with the ignore file in place, the machine's hooks file, an agent's card and diary, and a checkout directory placed under it are all invisible to git, while the ignore file itself is the one thing git offers to track.
