# Bug analysis: packages/framework/src/driver/actions-zip.ts

## Business logic (high-level)

A ~60-line read-only zip reader with exactly one caller: the Actions driver, recovering an agent's
transcript from a workflow run's artifact (#610). GitHub's artifact download API always returns a
zip, even for a single file, and that download is the only REST-readable channel out of an Actions
runner, so this exists because Node ships deflate but no zip and the framework takes no runtime
dependencies.

Scope is deliberately narrow: only what `actions/upload-artifact` writes — stored (method 0) or
deflated (method 8) entries, no zip64, no encryption. The governing invariant, stated in the SPEC and
in the JSDoc, is **all-or-nothing**: anything unrecognized throws rather than yielding a partial
archive, because a silently truncated transcript reads as an agent that said less than it actually
did, and the driver would then judge a turn on a short transcript.

Structural decision worth checking: it walks the **central directory** and uses the central copy's
`compressedSize`, but locates the bytes through each entry's **local** header (re-reading the local
name and extra lengths, which may differ from the central record's). That is the correct pairing —
a local header may declare sizes of 0 and defer them to a data descriptor (general-purpose flag bit
3), which the central directory never does, while the local extra field is the one that actually
sits in front of the data. Both halves of that reasoning are implemented, not just documented.

Field offsets audited against the PKZIP APPNOTE:

- EOCD: `+10` total entries (uint16), `+16` central directory offset (uint32), `+20` comment length.
  The code reads `+10` (total) rather than `+8` (entries on this disk) — the right one for a
  single-disk archive and identical for GitHub's.
- Central header: `+10` method, `+20` compressed size, `+28`/`+30`/`+32` name/extra/comment lengths,
  `+42` local header offset, `+46` name. All correct, and the per-entry stride
  `46 + name + extra + comment` matches.
- Local header: `+26` name length, `+28` extra length, data at `+30 + name + extra`. Correct.

Failure modes and how they land:

- Not a zip / random bytes → the backwards scan exhausts and throws "no end-of-central-directory".
- Shorter than an EOCD → "too short to be an archive".
- A central record whose signature is wrong → throws, naming the offset.
- A method other than 0/8 (bzip2, zstd, or an *encrypted* entry, whose method is still 8 but whose
  bytes are enciphered) → the unsupported-method throw catches the first two; encryption is **not**
  detected (general-purpose flag bit 0 is never read), so an encrypted deflate entry would fail
  inside `inflateRawSync` instead — still a throw, still all-or-nothing, just with a worse message.
  `upload-artifact` never encrypts, so this is a message-quality reliance, not a data risk.
- A corrupt/garbage offset (zip64 sentinels, a truncated central directory) → `readUInt32LE` throws
  `RangeError [ERR_OUT_OF_RANGE]`. Ugly but loud, which is what the all-or-nothing rule requires.

The one place the all-or-nothing rule is not enforced by construction: `buf.subarray(start, start +
compressedSize)` **clamps** silently at the end of the buffer, so a *stored* entry in a truncated
download would come back short with no error (a deflated one would fail inside `inflateRawSync`).
Reaching it requires a buffer whose EOCD and central directory are intact while the local data is
missing — a truncated HTTP body loses the tail, which is exactly where the EOCD lives, so `findEocd`
rejects it first. Recorded as a reliance on where truncation lands, not a live defect.

## Functions (low-level)

- **`readZip(buf)` (L42)** — reads the entry count and central offset from the EOCD, then walks
  `count` records. Each iteration validates the signature before reading anything else, so a
  mis-stepped cursor cannot silently produce garbage entries. Edge cases: zero entries → `[]` (a
  legitimate empty artifact); a name of length 0 → an entry named `''`, harmless since the caller
  looks entries up by name; directory entries (`"dir/"`, method 0, size 0) → an entry with an empty
  buffer, which the caller's name lookup ignores; non-ASCII names decode as UTF-8 unconditionally
  (flag bit 11 is not consulted), correct for `upload-artifact` and for the fixed ASCII names the
  driver actually looks for. Entry order follows the central directory, which is the order
  `upload-artifact` writes and the order the test pins. Verdict: correct.
- **`readLocalEntry(buf, offset, method, compressedSize, name)` (L65)** — validates the local
  signature (so a bad `+42` offset throws rather than inflating noise), computes the data start from
  the *local* name/extra lengths, then either copies (`Buffer.from(raw)`, so the returned buffer does
  not alias the download — important, since the caller holds entries after the big buffer could
  otherwise be kept alive) or inflates raw deflate. `inflateRawSync` throws on corrupt or truncated
  streams, which is the desired all-or-nothing behavior. Verdict: correct.
- **`findEocd(buf)` (L78)** — length guard first, then the no-comment fast path at
  `length - 22`, then a byte-wise backwards scan bounded by the maximum comment size (0xffff).
  Bounds are right: the scan starts at `length - 23` and every `readUInt32LE(i)` has 4 bytes
  available; `floor` cannot go negative. Scanning *backwards* is what makes it pick the last
  signature, i.e. the real EOCD rather than a signature-like sequence inside compressed data — the
  only case that could still fool it is an archive whose *comment* contains the EOCD signature, which
  no producer writes. Verdict: correct.

## Bugs found

None found.
