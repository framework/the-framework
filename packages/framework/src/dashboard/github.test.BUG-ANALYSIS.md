# Bug analysis: packages/framework/src/dashboard/github.test.ts

## Business logic (high-level)

Five tests over the four exports of `github.ts`. Pure-function tests for the two parsers, and
injected-`git` tests for the two async wrappers — no repository is created, which is right: nothing
here depends on real git state, only on the string git hands back.

What is pinned:

- All six remote spellings the SPEC claims to handle normalise to the same canonical URL: scp-style
  with and without `.git`, ssh, https with and without `.git`, and https with an embedded credential
  *and* a trailing newline.
- Non-GitHub hosts, a bare `https://github.com/`, an owner with no repo, and the empty string all
  yield `undefined`.
- The slug form splits owner and repo, and inherits the same rejections.
- Both async wrappers read `origin` and swallow a failing git into `undefined`.

**Do the tests verify what they claim?** Yes, and the fixture choices are deliberate rather than
incidental:

- `:12` combines three edge cases in one input — the `user@` credential, the `.git` suffix and the
  trailing `\n` — so a regression in any of the three fails it.
- `:18` and `:19` are the two shapes the `^[^/]+\/[^/]+$` validity check exists for. Without that
  check, `https://github.com/only-owner` would produce the plausible-looking but broken
  `https://github.com/only-owner`, and the test would catch it.
- `:31` and `:44` both feed a trailing newline through the async path, so the `trim()` is exercised on
  the realistic input shape (`git remote get-url` always appends one).
- The failure halves at `:34` and `:47` use a throwing runner, so they pin the try/catch rather than a
  fallback value.

**Not covered** (gaps, not defects): the case-sensitivity of the host match (`GitHub.com`), an ssh URL
with an explicit port, a `git://` remote, and a URL with a path beyond the slug
(`https://github.com/o/r/tree/main`, which the validity check rejects). All of these degrade to "no
link", so the untested paths fail safe.

## Functions (low-level)

### `'githubUrlFromRemote normalizes the common remote forms'` (L5)

Six inputs, one shared `expected`. Using a single expected constant is what makes it a *normalisation*
test rather than six independent transformations. *Verdict:* correct.

### `'githubUrlFromRemote returns undefined for non-GitHub or junk remotes'` (L15)

Five rejections: a different host with the scp form, a different host with the https form, an empty
path, an incomplete slug, and the empty string. Covers both the "no match" and the "matched but
invalid slug" exits. *Verdict:* correct.

### `'githubSlugFromRemote splits owner and repo…'` (L23)

One positive (`deepEqual` on the object, so a swapped owner/repo fails) and two negatives, one of
which (`only-owner`) checks that the slug form inherits the URL form's validity check rather than
having its own. *Verdict:* correct.

### `'githubSlugFor reads origin and returns undefined when git fails (#1050)'` (L29)

Both halves in one test: a successful read (with newline) and a throwing runner. Neither asserts the
*arguments* passed to git, so a regression that read a different remote name would pass — a minor gap,
though `github.ts` hard-codes `origin` as a literal. *Verdict:* correct.

### `'githubUrlFor reads origin and returns undefined when git fails'` (L42)

Same shape over the URL form, with the scp-style input. *Verdict:* correct.

## Bugs found

None found.
