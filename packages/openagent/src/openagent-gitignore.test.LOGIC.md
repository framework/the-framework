What the tests cover, against a real git repository:

- **Everything under `.openagent/` is hidden from git** - with the ignore file in place, git's status lists nothing: not the machine's hooks file, not an agent's card and diary, not a directory placed under it, and not the ignore file itself.
