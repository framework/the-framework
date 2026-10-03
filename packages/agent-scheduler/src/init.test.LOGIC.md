What the tests cover, against real files (the merge into a person's file is the writer's, covered in `agent-runner`):

- **A fresh file** - a project with the dashboard's directory and no hooks file gets two keys, `open` and `close`, and the file reads back as exactly `npx agent-scheduler start` under `open` and `npx agent-scheduler stop --unless-keep-alive` under `close`, with no other key.
