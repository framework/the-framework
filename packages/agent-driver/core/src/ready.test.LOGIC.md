What the tests cover, with a made-up CLI's questions and answers handed in and never a real CLI:

- **Ready** - an installed, logged-in CLI has no problem and no warning.
- **Not installed** - a missing CLI is one problem naming its binary and its install fix, and its login is not asked.
- **Logged out** - a CLI whose answer reads as no is one problem naming its login command.
- **Could not say** - a CLI whose login answer cannot be read (an older CLI's "unknown command") is ready.
- **Root** - root is one warning naming the `sudo` user, and no problem.
