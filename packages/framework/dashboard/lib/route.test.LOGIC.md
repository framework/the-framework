What the tests cover:

- **Reading a path** - `/` and an empty path select the Overview; one segment selects a project's home; two segments select one agent of that project; a trailing slash and any extra segments are ignored; segments are percent-decoded (`a%20b` reads as `a b`, `c%2Fd` as `c/d`) and a segment with a malformed escape is kept exactly as typed.
- **The reserved first segment** - `/settings` selects Settings, also with a trailing slash or a stray segment after it; only the exact word is reserved, so `/settings-a1b2` and `/my-settings` select projects.
- **No tickets view** - `/tickets` is a widget's page like any other dash-less word, with the segments after it (`/tickets/<project id>/<ticket file>/plan`) as that page's own path; under a project, `tickets` is an agent id like any other second segment.
- **Writing a path** - the Overview, a project home and an agent view each write their path; an agent without a project writes `/`; segments are percent-encoded; Settings outranks a stale project id and agent id.
- **A widget's page** - `/logs` and `/logs/<more>` select the widget page `logs` with the segments after it, and no project; a project id with its dash still selects a project, and `settings` stays a view; a widget's page writes `/<word>`.
- **Round trip** - every route shape, a widget's page with and without its own segments included, reads back unchanged from the path written for it.
