Proxies the dashboard's browser-preview pane to a run's in-run browser bridge (#813): `/browser/<projectId>/<runId>/stream|input` is forwarded to the loopback port the run recorded on its own meta.

## TLDR

- `parseBrowserRoute` parses the URL defensively (malformed escapes return undefined and fall through to the SPA bundle rather than throwing, #938); ids are only ever used for lookup, never as paths.
- `defaultBrowserPortLookup` resolves project id → cwd → live run meta → `browserStreamPort`, and only for a `status === 'running'` run.
- `handleBrowserProxy` streams both ways (never buffers — `/stream` is an endless `multipart/x-mixed-replace` body), returns false for non-browser URLs so the server carries on to the bundle.

## Problems

- The per-run bridge (#802) lives on an OS-picked port on a different origin than the daemon, so the pane cannot POST to it directly without CORS — and answering a preflight would let browser origins reach the bridge, giving up #802's containment of Chrome's debug port.
- The run can die mid-stream: upstream errors answer 502 (if headers not sent) and end the response; pane disconnect destroys the upstream so the run stops serving a dead viewer.

## Decisions

- The run's port is never named by the client — it comes from the run's own meta — so this cannot be used as an open relay into anything else listening on loopback.
- Port lookup only honors a live run: the bridge is torn down with the run, so a finished run's recorded port could now belong to anything the OS handed that number next.
- A 404 miss is ordinary (the pane polls while a run starts; a run may have no browser), so it is not logged.
- Frames are a live view of what the human types: `cache-control: no-store` on every proxied response.
