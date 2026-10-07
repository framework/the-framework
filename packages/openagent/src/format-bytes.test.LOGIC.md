What the tests cover:

- **Readable units** - a count is shown in the largest unit that keeps it readable, from bytes up to terabytes, with a decimal only where it adds meaning (`1.5 KB`, `512 MB`, `3 TB`).
- **Unreadable sizes** - an absent, negative or non-numeric count shows a placeholder (an en dash by default, or the caller's own, including an empty one) instead of a zero.
