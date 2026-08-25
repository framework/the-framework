/**
 * GitHub's issue-closing grammar, and how to defuse it (#1567).
 *
 * A pull request whose body says `close #1164` closes that issue the moment the PR merges.
 * That is the wanted behaviour when the PR completes the issue — the handoff puts `(fix #42)`
 * on the title of an implementing agent's PR for exactly that reason (#1334). It is the wrong
 * behaviour when the PR delivers something short of the work: a plan agent's PR lands a plan
 * whose own text says the implementation is still to come, and a sentence like "…then close
 * #1164" reads perfectly sensibly to the human reviewing it while quietly closing the ticket.
 *
 * That happened (#1560 closed #1164, and the next tickets sync then deleted the ticket and its
 * fresh plan). The cure is not to forbid the phrase — the agent is describing its plan, and the
 * sentence is true — but to break the adjacency GitHub's parser needs. The keyword only counts
 * when the reference follows it directly, so two words in between end its authority while the
 * sentence keeps saying what it said.
 */

/**
 * The keywords GitHub accepts before an issue reference, per its "linking a pull request to an
 * issue" documentation. Matched case-insensitively; every listed form (and its plural/past
 * tense) is a live trigger.
 */
const CLOSING_KEYWORDS = ['close', 'closes', 'closed', 'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved']

/**
 * What goes between the keyword and the reference. Chosen to read as the sentence's own words
 * rather than as an escape: "…then close the ticket #1164" is what the agent meant anyway.
 */
const FILLER = 'the ticket'

/**
 * A closing keyword, the gap GitHub allows after it, then an issue reference — `#123`, or the
 * cross-repo `owner/repo#123` form, which closes just as well. The gap is whitespace or a colon
 * ("The keywords can be followed by colons... `Closes: #10`", per the same documentation), and it
 * is re-emitted verbatim so the sentence keeps its own punctuation. A reference already inside
 * backticks is left alone: GitHub does not act on one, and rewriting it would corrupt a code sample.
 */
const CLOSING_PHRASE = new RegExp(
  String.raw`(^|[^\`\w])(${CLOSING_KEYWORDS.join('|')})(\s*:\s*|\s+)((?:[\w.-]+\/[\w.-]+)?#\d+)(?!\`)`,
  'gi',
)

/**
 * Rewrite every closing phrase in `text` so GitHub stops reading it as a command, leaving the
 * issue reference itself untouched: `close #1164` becomes `close the ticket #1164`.
 *
 * The reference stays live — clickable, and still cross-referenced onto the issue's own timeline,
 * so the ticket is told a pull request mentioned it. Only the closing authority is removed.
 *
 * Idempotent by construction: after the rewrite the keyword is followed by the filler rather than
 * by a reference, so a second pass finds nothing to change.
 */
export function defuseClosingKeywords(text: string): string {
  return text.replace(
    CLOSING_PHRASE,
    (_all, before: string, keyword: string, gap: string, ref: string) => `${before}${keyword}${gap}${FILLER} ${ref}`,
  )
}
