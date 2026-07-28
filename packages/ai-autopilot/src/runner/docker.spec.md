`DockerRunner` — the sandboxed counterpart to `LocalRunner`: each workspace is a container driven through the `docker` CLI (no npm docker dependency), rooted at `/workspace`, with the preview port published to an ephemeral host port.

## TLDR

- `docker(args, input?)` spawns the CLI once with no shell, piping `input` to stdin; it rejects only when the binary can't spawn — non-zero exits come back in the `ExecResult`. `dockerAvailable()` = `docker info` exits 0, so callers/tests can skip.
- `boot()`: `docker run -d --name ai-autopilot-<ts36>-<seq> -w /workspace [-p 127.0.0.1:0:<previewPort>] <image> tail -f /dev/null` (default image `node:20-alpine`), then seeds files via `fs.write`; on failure rolls back with `rm -f`.
- `DockerFs` drives `cat` / `sh -c 'mkdir -p "$(dirname "$0")" && cat > "$0"'` / `rm -rf` / `find -type f` / `test -e` through `docker exec`; paths guarded by `safeSegments` under `/workspace`; `list` strips the `/workspace/` prefix and sorts; missing dir → `[]`.
- `exec()`: `docker exec -w <cwd> -e K=V <container> sh -c <cmd>`; timeout enforced host-side by SIGKILLing the exec client → exit 124; otherwise `docker exec` propagates the in-container exit code.
- `start()`: the shell writes `$$` to `/tmp/ai-autopilot-start-N.pid` then `exec`s the command (so the pid is the command's, not the shell's); `stop()` kills that in-container pid TERM → 2s → KILL, then SIGKILLs the host-side exec client.
- `preview()`: only the boot-time `previewPort` (default 3000) is served — any other port is a clear error telling you to construct `DockerRunner({ previewPort })`; asks `docker port` for the mapped host port; `waitMs` readiness is probed from *inside* the container.
- `dispose()`: stop procs, then `docker rm -f` as a backstop for anything the signals missed; frees the published port.

## Problems

- False readiness through Docker Desktop: the host-side port proxy pre-binds the published port, so a host TCP connect succeeds before the real server is up. Readiness is therefore probed inside the container with a `node -e` connect loop against `127.0.0.1:<port>`.
- Docker maps ports only at container start, so the preview port must be fixed at boot — surfaced as an explicit error rather than a hang.
- Stopping a background process: the host only holds the `docker exec` client, not the in-container process — hence the pidfile + `exec` trick so `stop` can signal the real pid.

## Decisions

- Shells out to the `docker` CLI instead of depending on a docker npm package.
- `fs.write` passes the target path as `$0` to `sh -c` so it can never be interpreted as shell.
- Publishes on `127.0.0.1:0` — loopback-only, ephemeral host port.

## Facts

- The dev server must bind `0.0.0.0` inside the container (not `127.0.0.1`) or the published port can't reach it.
- Container names stay unique per process via `Date.now().toString(36)` + a module-level counter.
