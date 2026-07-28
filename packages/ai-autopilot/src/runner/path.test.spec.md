Tests for `path.ts` — covers `norm` normalization (leading `./`//, trailing slashes, no `..` resolution), `safeSegments` splitting, in-workspace `..` resolution, root forms (`.`/``/`/` → no segments), rejection of every escaping path with the unnormalized path in the message, and segments merely starting with `..` (e.g. `..hidden.txt`) not being treated as escapes.

## Facts

- Tested directly because the guard decides whether an agent can write outside its workspace and it is pure: `docker.test.ts` is gated on a live daemon, and webcontainer's former copy of these rules had no test at all before they moved here.
