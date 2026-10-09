import { describe, expect, test } from 'vitest'
import { EMPTY_DRAFT, TEXT_MAX, addArgs, draftProblem, draftSentence, editArgs, editedWords, isUntouched, keptWhereHint, openedAutomation, paceHint, removeWarning, removedWords, savedFile, savedWords, saysTheSame, showsChangeWhen, showsWhen, startsWhen, triedLine, whereHint, type AutomationDraft } from './automation-form.js'

// The automation form as data: what keeps a draft from being saved, the command that saves it, the sentence its row would say, what a try answered, an automation opened from its row to be saved again, and what is said of one removed.

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
    expect(draftSentence(draft({ count: '15', unit: 'm', when: CHECK }))).toBe('Every 15 minutes at most, when its shell line prints something')
    expect(draftSentence(draft({ count: '15', unit: 'm', when: CHECK, waitsFor: 'when someone commented' }))).toBe('Every 15 minutes at most, when someone commented')
    expect(draftSentence(draft({ paced: false, when: CHECK, waitsFor: 'when someone commented' }))).toBe('When someone commented')
    expect(draftSentence(draft({ paced: false, when: CHECK }))).toBe('When its shell line prints something')
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

describe('an automation opened from its row', () => {
  const FILE = '.claude/skills/answer-comments/SKILL.md'
  const SHOWN = { ok: true, name: 'answer-comments', prompt: 'Answer each new comment below.', every: '15m', when: CHECK, waitsFor: 'when someone commented', file: FILE }

  test('what `show` answered opens the form as the file says it: the pace as a count and a unit, no pace unticked, and where it is kept; an answer the form cannot show opens nothing', () => {
    expect(openedAutomation(SHOWN)).toEqual({ draft: { name: 'answer-comments', prompt: 'Answer each new comment below.', paced: true, count: '15', unit: 'm', when: CHECK, waitsFor: 'when someone commented', onThisMachine: false }, file: FILE })
    // By its shell line alone: the pace is unticked, on the count and the unit a new form opens with.
    expect(openedAutomation({ name: 'x', prompt: 'p', when: 'true', file: 'f', onThisMachine: true })).toEqual({ draft: { name: 'x', prompt: 'p', paced: false, count: '1', unit: 'd', when: 'true', waitsFor: '', onThisMachine: true }, file: 'f' })
    expect(openedAutomation({ name: 'x', prompt: 'p', every: '2w', file: 'f' })?.draft).toMatchObject({ paced: true, count: '2', unit: 'w', when: '', waitsFor: '' })
    // Saving such a form unchanged would write the file as it is.
    expect(editArgs(openedAutomation(SHOWN)!.draft, FILE)).toEqual(['edit', 'answer-comments', '--prompt=Answer each new comment below.', '--every=15m', `--when=${CHECK}`, '--waits-for=when someone commented'])
    // Not what the command promises, or a pace the form has no fields for: nothing opens, so nothing else is saved over the file.
    for (const answer of [null, 'text', {}, { name: 'x', prompt: 'p' }, { name: 'x', file: 'f' }, { prompt: 'p', file: 'f' }, { name: 'x', prompt: 'p', file: 'f', every: 'often' }, { name: 'x', prompt: 'p', file: 'f', every: 15 }]) expect(openedAutomation(answer)).toBeUndefined()
  })

  test('saving it again runs `edit` with its name and every part the form has, a part it does not have as an empty flag that takes it out of the file, never where it is kept; nothing is to save until the form says something else', () => {
    const opened = openedAutomation(SHOWN)!.draft
    // The pace unticked: taken out, not left as the file says it.
    expect(editArgs({ ...opened, prompt: '- Answer in one line.', paced: false }, FILE)).toEqual(['edit', 'answer-comments', '--prompt=- Answer in one line.', '--every=', `--when=${CHECK}`, '--waits-for=when someone commented'])
    // The shell line emptied: taken out, and what it waited for with it, whatever that field still holds.
    expect(editArgs({ ...opened, when: ' ' }, FILE)).toEqual(['edit', 'answer-comments', '--prompt=Answer each new comment below.', '--every=15m', '--when=', '--waits-for='])
    expect(editArgs({ ...opened, waitsFor: '' }, FILE)).toEqual(['edit', 'answer-comments', '--prompt=Answer each new comment below.', '--every=15m', `--when=${CHECK}`, '--waits-for='])
    expect(editArgs({ ...opened, onThisMachine: true }, FILE)).toEqual(['edit', 'answer-comments', '--prompt=Answer each new comment below.', '--every=15m', `--when=${CHECK}`, '--waits-for=when someone commented'])
    expect(editArgs({ ...opened, prompt: ' ' }, FILE)).toBeUndefined()
    // A text too long for the form is changed in its file, which the form names.
    expect(draftProblem({ ...opened, prompt: 'p'.repeat(TEXT_MAX + 1) }, FILE)).toBe(`What the agent is told is 4001 characters, and this form takes 4000 at most. Change it in its file, ${FILE}.`)
    expect(editArgs({ ...opened, prompt: 'p'.repeat(TEXT_MAX + 1) }, FILE)).toBeUndefined()

    expect(saysTheSame(opened, { ...opened })).toBe(true)
    // Blanks around a text are not part of what is saved.
    expect(saysTheSame(opened, { ...opened, prompt: `  ${opened.prompt}\n` })).toBe(true)
    for (const change of [{ prompt: 'Other.' }, { count: '30' }, { unit: 'h' as const }, { paced: false }, { when: 'true' }, { waitsFor: 'when it rains' }]) expect(saysTheSame(opened, { ...opened, ...change }), JSON.stringify(change)).toBe(false)
  })

  test('what a saved change is: a shared one is a change to commit, and an agent is told the new words only once it is where a checkout starts; one kept on this machine needs nothing', () => {
    expect(editedWords({ startsFrom: 'origin/main', onThisMachine: false })).toBe(
      'It is a change to a file of yours, in this project, and nothing was committed for you. An agent is told the new words only once the change is on origin/main: commit it and bring it there. The pace and the shell line are read from your file, so the scheduler uses the new ones from its next look. Its past runs, its switch and your picks for it stay.',
    )
    expect(editedWords({ startsFrom: 'HEAD', onThisMachine: false })).toContain('An agent is told the new words only once you commit the change. ')
    expect(editedWords({ startsFrom: 'origin/main', onThisMachine: true })).toBe('It is kept on this machine alone: nothing to commit. The scheduler uses the new words from its next look. Its past runs, its switch and your picks for it stay.')
    expect(showsChangeWhen(true)).toBe('Its row shows the change once the scheduler has looked, within a minute.')
    expect(showsChangeWhen(false)).toBe('The scheduler is not running in this project, so its row shows the change once the scheduler runs.')
    expect(keptWhereHint(openedAutomation(SHOWN)!)).toBe(`A skill file in this project, ${FILE}: the change is yours to commit.`)
    expect(keptWhereHint(openedAutomation({ ...SHOWN, file: '.agent-scheduler/automations/answer-comments.md', onThisMachine: true })!)).toBe('Kept on this machine alone, outside git: .agent-scheduler/automations/answer-comments.md.')
  })

  test('removing: the row says first what is deleted and what of it git can bring back, and afterwards what is left for the person to do, by what git still holds of the file', () => {
    expect(removeWarning({})).toBe(
      'Its skill file is deleted from your files in this project, and nothing is committed for you. Git can bring back only what you committed of it: a file never committed, or your last changes to it, cannot be brought back. Everyone else who has the project keeps the row until your deletion reaches them. Its switch and your picks for it go with it. The records of its past runs stay.',
    )
    expect(removeWarning({ onThisMachine: true })).toBe('Its file is deleted. It is kept on this machine alone, outside git, so it cannot be brought back. Its switch and your picks for it go with it. The records of its past runs stay.')
    // In a commit: the deletion is the person's to commit.
    expect(removedWords('/answer-comments', { ok: true, command: 'answer-comments', file: FILE, git: 'committed', startsFrom: 'origin/main' })).toBe(`Removed /answer-comments: ${FILE} is deleted, and nothing was committed for you. Commit the deletion and bring it to origin/main: until then everyone else who has the project keeps the row.`)
    expect(removedWords('/answer-comments', { ok: true, file: FILE, git: 'committed', startsFrom: 'HEAD' })).toBe(`Removed /answer-comments: ${FILE} is deleted, and nothing was committed for you. Commit the deletion.`)
    // Staged and never committed: "commit the deletion" would commit the file.
    expect(removedWords('/answer-comments', { ok: true, file: FILE, git: 'staged', startsFrom: 'origin/main' })).toBe(`Removed /answer-comments: ${FILE} is deleted. It was staged and never committed, so a commit made now would still add it: take it out of the next commit with "git rm --cached ${FILE}".`)
    // Git never had it.
    expect(removedWords('/answer-comments', { ok: true, file: FILE, git: 'nothing', startsFrom: 'origin/main' })).toBe(`Removed /answer-comments: ${FILE} is deleted. Git never had the file, so nothing is to commit.`)
    expect(removedWords('tidy', { ok: true, file: '.agent-scheduler/automations/tidy.md', onThisMachine: true })).toBe('Removed tidy: .agent-scheduler/automations/tidy.md is deleted. Nothing is to commit.')
    // Git could not be asked, or an answer that is not what the command promises: it is gone, and the person is sent to git to look.
    expect(removedWords('/answer-comments', { ok: true, file: FILE, git: 'unknown', startsFrom: 'origin/main' })).toBe(`Removed /answer-comments: ${FILE} is deleted. What git holds of it could not be read: look with "git status".`)
    expect(removedWords('tidy', null)).toBe('Removed tidy: its file is deleted. What git holds of it could not be read: look with "git status".')
  })
})
