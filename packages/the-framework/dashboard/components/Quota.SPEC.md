The Usage panel: the account's quota week as one bar, so "am I ahead or behind?" is a glance — the fill is what has been spent, a tick marks how much may be gone by now, and the colour compares the two.

## Flows

- The bar splits into the used fill and, dimmed, the budget left for autonomous AI; dragging the dimmed segment's own edge sets where unattended work stops, and the legend says whether autonomous AI currently has room (enabled) or none (disabled).
- The headline is a duration, not a percentage: how far ahead of or behind the week's pace consumption runs.
- Beside it, two readings of the same spend: how much quota *time* it consumed, and what share of the pro-rata allowance elapsed so far that is — 100% being exactly on pace. The dollar figure says nothing about whether today's rate is sustainable, and a share of the week answers how much is left rather than how fast it is going. The share is absent at the very start of the week, where the allowance so far is zero and every amount is infinitely above it.
- Setting the stop more than a full day ahead of pace earns an eager-consumption warning; the other limits (the session, a model's own week) tuck behind "show all limits".

## Rationales

- A week the panel cannot place is a loud error quoting the text it could not read — a quiet fallback would hide a real defect for weeks. Each of the three ways of failing gets its own sentence: an unreadable reset phrasing shows that phrasing; a week line carrying no reset time at all says that, and does not claim a parse failure it did not have, since that readout parsed exactly as printed and simply left the week with only one end of its span; and a readout with no week names the line that is missing and lists the labels that arrived instead. The readout is prose from another program, so those labels are the whole diagnosis — and a message that borrows the wrong case is worse than none, since it denies a week the panel is listing directly below it.
- Numbers that outlive failed refreshes are dated, since an undated bar claims to be current.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
