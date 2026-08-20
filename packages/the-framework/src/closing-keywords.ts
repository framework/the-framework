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
 * sentence is true — but to write the issue reference in a form GitHub's parser does not read as
 * a command. Backticks do it: `close `#1164`` renders as the same words and links nowhere.
 */

/**
 * The keywords GitHub accepts before an issue reference, per its "linking a pull request to an
 * issue" documentation. Matched case-insensitively; every listed form (and its plural/past
 * tense) is a live trigger.
 */
const CLOSING_KEYWORDS = ['close', 'closes', 'closed', 'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved']

/**
 * A closing keyword, whitespace, then an issue reference — `#123`, or the cross-repo
 * `owner/repo#123` form, which closes just as well. Only a reference already inside backticks
 * is left alone, since it is already defused; that is what makes this safe to run twice.
 */
const CLOSING_PHRASE = new RegExp(
  String.raw`(^|[^\`\w])(${CLOSING_KEYWORDS.join('|')})(\s+)((?:[\w.-]+\/[\w.-]+)?#\d+)(?!\`)`,
  'gi',
)

/**
 * Rewrite every closing phrase in `text` so GitHub stops reading it as a command, leaving the
 * words as the agent wrote them: `close #1164` becomes ``close `#1164``.
 *
 * Prose only — the reference keeps its own text, so a human reads the same sentence and the
 * PR simply stops closing an issue it did not finish.
 */
export function defuseClosingKeywords(text: string): string {
  return text.replace(CLOSING_PHRASE, (_all, before: string, keyword: string, gap: string, ref: string) => `${before}${keyword}${gap}\`${ref}\``)
}
