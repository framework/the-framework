// The prompt that resumes an agent after the person answered its question is one fixed sentence
// (`continuationPrompt` in `agent-driver`): the question, then the answer. The chat draws it as
// what it is, a question and its answer, not as a message the person typed.

/** The question and the answer a resuming prompt carries, or undefined for any other prompt. */
export function answeredQuestion(prompt: string): { question: string; answer: string } | undefined {
  const match = /^You paused to ask: "([\s\S]*)"\. The user chose: ([\s\S]*)\. Continue with that decision\.$/.exec(prompt)
  return match ? { question: match[1]!, answer: match[2]! } : undefined
}
