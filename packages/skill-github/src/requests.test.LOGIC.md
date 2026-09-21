What the tests cover, with gh scripted:

- **The listing asked of gh** - state `all` by default, the head branch when named, the limit of 50 and the fields.
- **The shape** - states lowercased, the head as `branch` and `head`, `draft`, `mergedAt` only when set; a row without a number and a url is dropped; a non-list is no request.
- **Since** - by creation time, or by merge time when only merged ones were asked for; no `since` keeps all.
- **None is not could-not-tell** - a listing gh cannot answer throws; the open request of a branch reads as none then, and as the one request gh lists otherwise.
