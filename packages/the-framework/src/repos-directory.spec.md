Finds the git repos directly inside the user's configured repos directory (#1123), so the daemon can auto-register them on boot when the `reposDirectoryAutoGrant` opt-in is on.

## TLDR

- `listReposInDirectory(dir)`: the immediate subdirectories holding a `.git` (directory in a normal clone, file in a worktree/submodule), as sorted absolute paths.
- Only one level deep on purpose: the auto-grant's blast radius is "this directory of repos", not the whole tree. A missing dir yields `[]`, never throws on boot. Fs is an injectable seam (`ReposDirectoryFs`).
