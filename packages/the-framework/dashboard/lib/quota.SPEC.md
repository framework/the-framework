Feeds the dashboard's quota panel: where the account's quota stands against its limits, and what Auto PM last decided. Both are asked of the daemon every thirty seconds while the panel is open, since the daemon already keeps a cached reading and answering is cheap — unlike the driver read behind it — and since Auto PM runs on the daemon's clock, so the panel only learns of a new decision by asking again.

Neither answer exists until the first reply arrives, and a host that runs no Auto PM has no decision to report. A failed request keeps the last known reading rather than blanking it, because an empty bar would read as "nothing used".

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
