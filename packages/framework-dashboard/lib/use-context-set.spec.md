`useContextSet()` — the run Context set (#492/#504): the file/repo paths the user picked to focus the agent, as immutable `Set` state with `add`/`remove`/`toggle`/`reset`.

## TLDR

- Every mutation builds a fresh `Set` (no-op returns the previous reference) so React sees changes.
- Owned by the shell so the Start form's `#`/whole-repo picker and the right-rail file tree share one source of truth; `reset()` clears it on project switch (paths were the old project's).
- `remove` exists for a deleted `@`/`#` chip (#948): the editor and the Context set must not diverge.
