import { describe, expect, test } from 'vitest'
import { EMPTY_DRAFT, TEXT_MAX, addArgs, draftProblem, draftSentence, isUntouched, paceHint, savedFile, savedWords, showsWhen, startsWhen, triedLine, whereHint, type AutomationDraft } from './new-automation.js'

// The "New automation" form as data: what keeps a draft from being saved, the command that saves it, the sentence its row would say, and what a try answered.

const draft = (over: Partial<AutomationDraft> = {}): AutomationDraft => ({ ...EMPTY_DRAFT, name: 'answer-comments', prompt: 'Answer each new comment below.', ...over })
const CHECK = `gh api "repos/{owner}/{repo}/issues/comments?since=$LAST_RUN" --jq '[.[] | {url: .html_url}]'`

describe('a new automation', () => {
  test('the form opens on a pace of one day and no shell line, and says what is missing, the first thing first', () => {
    expect(EMPTY_DRAFT).toEqual({ name: '', prompt: '', paced: true, count: '1', unit: 'd', when: '', waitsFor: '', onThisMachine: false })
    expect(draftProblem(EMPTY_DRAFT)).toBe('Give it a name. It becomes the command, like /answer-comments.')
    // One kept on this machine is no command a person types.
    expect(draftProblem({ ...EMPTY_DRAFT, onThisMachine: true })).toBe('Give it a name, like answer-comments.')
    expect(draftProblem(draft({ name: 'Answer comments' }))).toBe('A name is lower-case letters, digits and dashes, never three dashes in a row, like answer-comments.')
    expect(draftProblem(draft({ name: 'a'.repeat(65) }))).toBe('A name is 64 characters at most.')
    expect(draftProblem(draft({ name: 'a'.repeat(64) }))).toBeUndefined()
    expect(draftProblem(draft({ prompt: ' \n' }))).toBe('Write what the agent is told.')
    expect(draftProblem(draft({ count: '' }))).toBe('Type a whole number, from 1 to 9999.')
    expect(draftProblem(draft({ count: '1.5' }))).toBe('Type a whole number, from 1 to 9999.')
    expect(draftProblem(draft({ count: '0' }))).toBe('Type a whole number, from 1 to 9999.')
    expect(draftProblem(draft({ paced: false }))).toBe('Say when it runs: on a pace, by a shell line, or both.')
    // A count left half typed does not matter once the pace is unticked and a shell line says when.
    expect(draftProblem(draft({ paced: false, count: '', when: CHECK }))).toBeUndefined()
    expect(draftProblem(draft())).toBeUndefined()
    expect(draftProblem(draft({ name: '  answer-comments  ' }))).toBeUndefined()
    // A text longer than the dashboard hands a command is said before Save, not refused after it.
    expect(draftProblem(draft({ prompt: 'p'.repeat(TEXT_MAX) }))).toBeUndefined()
    expect(draftProblem(draft({ prompt: 'p'.repeat(TEXT_MAX + 1) }))).toBe('What the agent is told is 4001 characters, and this form takes 4000 at most. Save a shorter one, then write the rest into the file.')
    expect(draftProblem(draft({ when: 'w'.repeat(TEXT_MAX + 1) }))).toBe('The shell line is 4001 characters, and this form takes 4000 at most.')
    expect(draftProblem(draft({ when: CHECK, waitsFor: 'x'.repeat(TEXT_MAX + 1) }))).toBe('What the line waits for is 4001 characters, and this form takes 4000 at most.')
    expect(draftProblem(draft({ name: 'a---b' }))).toBe('A name is lower-case letters, digits and dashes, never three dashes in a row, like answer-comments.')
    expect(addArgs(draft({ prompt: 'p'.repeat(TEXT_MAX) }))!.every(arg => arg.length <= 4096)).toBe(true)
  })

  test('a form nothing was typed into, which Escape may close; and the words beside the pace, which say how the pace and the shell line decide together', () => {
    expect(isUntouched(EMPTY_DRAFT)).toBe(true)
    expect(isUntouched({ ...EMPTY_DRAFT, paced: false, count: '15', unit: 'm' })).toBe(true)
    for (const typed of [{ name: 'a' }, { prompt: 'p' }, { when: 'w' }, { waitsFor: 'x' }]) expect(isUntouched({ ...EMPTY_DRAFT, ...typed })).toBe(false)
    expect(isUntouched({ ...EMPTY_DRAFT, onThisMachine: true })).toBe(true)
    expect(paceHint(draft())).toBe('by time alone')
    expect(paceHint(draft({ when: CHECK }))).toBe('at most, and only when the shell line below prints something')
    expect(paceHint(draft({ paced: false, when: CHECK }))).toBe('not on a pace: the shell line below alone says when')
    expect(paceHint(draft({ paced: false, when: '  ' }))).toBe('not on a pace')
  })

  test('the command that saves it: each text one argument with its flag, a pace only when ticked, the plain words only with a shell line; none while something is missing', () => {
    expect(addArgs(draft())).toEqual(['add', 'answer-comments', '--prompt=Answer each new comment below.', '--every=1d'])
    expect(addArgs(draft({ count: ' 15 ', unit: 'm', when: `  ${CHECK}\n`, waitsFor: ' when someone commented ' }))).toEqual(['add', 'answer-comments', '--prompt=Answer each new comment below.', '--every=15m', `--when=${CHECK}`, '--waits-for=when someone commented'])
    expect(addArgs(draft({ paced: false, when: CHECK }))).toEqual(['add', 'answer-comments', '--prompt=Answer each new comment below.', `--when=${CHECK}`])
    // Plain words typed, then the shell line cleared: they say what a line waits for, and there is none.
    expect(addArgs(draft({ waitsFor: 'when someone commented' }))).toEqual(['add', 'answer-comments', '--prompt=Answer each new comment below.', '--every=1d'])
    // A prompt that opens with a dash stays the flag's own text.
    expect(addArgs(draft({ prompt: '- Answer.\n- Be short.' }))![2]).toBe('--prompt=- Answer.\n- Be short.')
    expect(addArgs(draft({ name: '' }))).toBeUndefined()
    expect(addArgs(draft({ paced: false }))).toBeUndefined()
    // Kept on this machine alone: the same command, with its flag last.
    expect(addArgs(draft({ onThisMachine: true }))).toEqual(['add', 'answer-comments', '--prompt=Answer each new comment below.', '--every=1d', '--private'])
    expect(addArgs(draft({ onThisMachine: true, paced: false, when: CHECK, waitsFor: 'when someone commented' }))).toEqual(['add', 'answer-comments', '--prompt=Answer each new comment below.', `--when=${CHECK}`, '--waits-for=when someone commented', '--private'])
  })

  test('when it would run, as its row would say it; nothing while nothing says when', () => {
    expect(draftSentence(draft())).toBe('Every 1 day')
    expect(draftSentence(draft({ count: '15', unit: 'm', when: CHECK }))).toBe('Every 15 minutes at most, when its check finds work')
    expect(draftSentence(draft({ count: '15', unit: 'm', when: CHECK, waitsFor: 'when someone commented' }))).toBe('Every 15 minutes at most, when someone commented')
    expect(draftSentence(draft({ paced: false, when: CHECK, waitsFor: 'when someone commented' }))).toBe('When someone commented')
    expect(draftSentence(draft({ paced: false, when: CHECK }))).toBe('When its check finds work')
    expect(draftSentence(draft({ paced: false }))).toBeUndefined()
    expect(draftSentence(draft({ count: '', when: CHECK }))).toBeUndefined()
    // Before a name is typed the sentence is already there: it does not name the command.
    expect(draftSentence({ ...EMPTY_DRAFT })).toBe('Every 1 day')
  })

  test('what a try answered: an agent would start, nothing to do, or the line failed and why; an answer that is not what the command promises is a failed line', () => {
    expect(triedLine({ ok: true, lastRun: '2026-10-08T10:00:00Z', ran: true, due: true, printed: '[{"url":"u"}]' })).toEqual({ lastRun: '2026-10-08T10:00:00Z', printed: '[{"url":"u"}]', verdict: 'It printed something: an agent would start now.', tone: 'start' })
    expect(triedLine({ ok: true, lastRun: '2026-10-08T10:00:00Z', ran: true, due: false, printed: '[]' })).toEqual({ lastRun: '2026-10-08T10:00:00Z', printed: '[]', verdict: 'It printed nothing to do: no agent would start.', tone: 'quiet' })
    expect(triedLine({ ok: true, lastRun: '2026-10-08T10:00:00Z', ran: false, due: false, printed: 'half', error: 'gh: not found' })).toEqual({ lastRun: '2026-10-08T10:00:00Z', printed: 'half', verdict: 'The line failed: gh: not found', tone: 'failed' })
    expect(triedLine({ ran: false, error: '' })).toEqual({ printed: '', verdict: 'The line failed.', tone: 'failed' })
    expect(triedLine(null)).toEqual({ printed: '', verdict: 'The line failed.', tone: 'failed' })
    expect(triedLine({ ran: 'yes', due: true, printed: 7 })).toEqual({ printed: '', verdict: 'The line failed.', tone: 'failed' })
  })

  test('what a save answered: the file, and where it has to get to before its row can start', () => {
    expect(savedFile({ ok: true, command: 'answer-comments', file: '.claude/skills/answer-comments/SKILL.md', startsFrom: 'origin/main' })).toEqual({ file: '.claude/skills/answer-comments/SKILL.md', startsFrom: 'origin/main', onThisMachine: false })
    expect(savedFile({ ok: true })).toEqual({ file: 'a skill file', startsFrom: 'HEAD', onThisMachine: false })
    expect(savedFile({ ok: true, file: '.agent-scheduler/automations/x.md', startsFrom: 'origin/main', onThisMachine: true })).toEqual({ file: '.agent-scheduler/automations/x.md', startsFrom: 'origin/main', onThisMachine: true })
    // What the person has to do with it: a shared one is theirs to commit and bring where a checkout starts; one kept here needs nothing.
    expect(savedWords({ startsFrom: 'origin/main', onThisMachine: false })).toBe('It is a file of yours, in this project, and nothing was committed for you. Its row cannot start before the file is on origin/main: commit it and bring it there.')
    expect(savedWords({ startsFrom: 'origin/main', onThisMachine: true })).toBe('It is kept on this machine alone: nothing to commit, and nobody else gets the row. Its row can start as soon as you switch it on. Its prompt is in the record of each run, which is shared where this project shares its records.')
    expect(whereHint(draft())).toBe('Saved as a skill file in this project, which you commit. The row starts switched off.')
    expect(whereHint(draft({ onThisMachine: true }))).toBe('Kept on this machine alone, outside git. The row starts switched off, and can start as soon as you switch it on.')
    expect(startsWhen('origin/main')).toBe('Its row cannot start before the file is on origin/main: commit it and bring it there.')
    expect(startsWhen('HEAD')).toBe('Its row cannot start before you commit the file.')
    // The rows are what the scheduler last read: one that is not running shows no new row.
    expect(showsWhen(true)).toBe('Its row shows here once the scheduler has looked, within a minute. It starts switched off.')
    expect(showsWhen(false)).toBe('The scheduler is not running in this project, so its row does not show yet: it shows once the scheduler runs. It starts switched off.')
  })
})
