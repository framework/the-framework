What the tests cover:

- **An output that fits** - it is kept whole, without its blank end, up to exactly the size limit.
- **An output past the limit** - its first half-limit and its last half-limit are kept, with one line between them saying how many characters were cut.
- **A call's argument** - a missing or blank one gives nothing; a short one-line one gives the detail alone; one of several lines, or a long one, gives the detail and the argument whole; the whole argument has the size limit of an output.
