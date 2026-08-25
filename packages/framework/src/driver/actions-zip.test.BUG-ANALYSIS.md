# Bug analysis: packages/framework/src/driver/actions-zip.test.ts

## Business logic (high-level)

Unit tests for the minimal zip reader behind the Actions driver's transcript recovery. Their central
problem is fixtures: Node can neither write nor read a zip, and shelling out to `zip` would not
survive Windows, so the suite **assembles real archive bytes by hand** (`makeZip`) and feeds them to
the reader. That is the right call — a mocked reader would test nothing, and the byte layout is
precisely what could be wrong.

What is pinned, against `actions-zip.test.SPEC.md`:

- **Deflated entries**: two files, asserted by name list *and* exact contents, so both the entry
  order (central-directory order) and the inflate path are covered.
- **Stored entries**: the method-0 branch, which `upload-artifact` uses for tiny files.
- **Multi-block transcripts**: a 5000-element JSON array, so the deflate stream spans more than one
  block; this is the assertion that would catch a reader that returned only the first block or
  mis-sized the compressed range.
- **Rejecting non-archives**: two shapes — arbitrary bytes long enough to scan (must hit the "no
  end-of-central-directory" throw) and a 4-byte buffer (must hit the "too short" guard). Both assert
  on the message, so the two error paths cannot be confused with each other, and neither can degrade
  into "an empty archive", which is the failure the SPEC is most afraid of.
- **A trailing comment**: the fast path is deliberately defeated and the backwards scan exercised.

Fixture fidelity check (does `makeZip` actually produce what the reader must handle?): local headers
carry signature, version, method, CRC, compressed and uncompressed sizes, and the name length;
central records carry signature, method, CRC, sizes, name length and the local-header offset; the
EOCD carries both entry counts, the central directory size and its offset. The running `offset`
accumulates `local + name + data` per entry, so the `+42` local offsets are genuinely correct rather
than incidentally zero — with one entry a wrong offset would still land on the single local header,
which is why the two-entry test matters. CRCs are computed for real (the standard reflected
`0xedb88320` table-less loop) even though the reader ignores them: that keeps the fixture honest if
the reader ever starts verifying them.

Coverage gaps (recorded, not defects): the unsupported-compression-method throw and the bad-central-
signature throw are unexercised; no fixture gives an entry a **local extra field that differs from
the central one**, which is the exact scenario the reader's local-header indirection exists for, so
a regression that used the central extra length would still pass; and no fixture uses a data
descriptor (local sizes of 0), the other reason the reader trusts the central copy's
`compressedSize`. All three are cheap to add to `makeZip` and would pin the reader's two structural
decisions rather than only its happy path.

## Functions (low-level)

- **`makeZip(files)` (L11)** — builds locals and centrals in one pass, tracking `offset` for the
  central records' local-header pointers. `Buffer.alloc` zero-fills, so the flags, timestamps and
  extra-field lengths it never sets are legitimately 0 — a valid archive, and the case the reader
  meets. `store` selects method 0 with the raw bytes; otherwise `deflateRawSync` (raw deflate, not
  zlib-wrapped, matching `inflateRawSync` on the read side — a zlib-wrapped stream here would fail
  and the mismatch would be a fixture bug, so it is worth noting it is right). Correct.
- **`crc32(buf)` (L57)** — the reflected CRC-32 loop, finished with `>>> 0` so the value is unsigned
  before `writeUInt32LE` (a signed result would throw on write). Correct.
- **Deflated-entries test (L66)** — `deepEqual` on the name list plus per-entry content assertions;
  the non-null assertions (`entries[0]!`) would throw legibly rather than pass if the reader returned
  fewer entries. Correct.
- **Stored-entries test (L80)** — asserts content only; the method-0 copy path. Correct.
- **Multi-block test (L85)** — regenerates the same string it asserts against, so the assertion
  cannot drift from the fixture. Correct.
- **Non-archive test (L93)** — both throws are matched by message. `Buffer.from('not a zip...')` is
  33 bytes, comfortably past the 22-byte guard, so it really does reach the scan rather than the
  length check — the two cases are genuinely distinct. Correct.
- **Comment test (L99)** — appends a comment and patches the EOCD's comment-length field at
  `withComment.length - comment.length - 2`, which resolves to `zip.length - 2`, i.e. EOCD+20. The
  arithmetic is right, and the patch is what makes the archive *valid* rather than merely
  scan-findable. Correct.

## Bugs found

None found.
