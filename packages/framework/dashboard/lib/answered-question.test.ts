import { expect, test } from 'vitest'
import { continuationPrompt } from 'agent-driver'
import { answeredQuestion } from './answered-question.js'

test('it reads the question and the answer out of the prompt the driver writes', () => {
  expect(answeredQuestion(continuationPrompt('Which color do you prefer?', 'Red'))).toEqual({ question: 'Which color do you prefer?', answer: 'Red' })
  // Several picks, and a question with quotes and a full stop in it.
  expect(answeredQuestion(continuationPrompt('Ship "v2". Now?', 'Red, Blue'))).toEqual({ question: 'Ship "v2". Now?', answer: 'Red, Blue' })
})

test('any other prompt is no answered question', () => {
  expect(answeredQuestion('Add a README.')).toBeUndefined()
  expect(answeredQuestion('I skip this question.')).toBeUndefined()
  expect(answeredQuestion(`${continuationPrompt('Q?', 'A')} And one more thing.`)).toBeUndefined()
})
