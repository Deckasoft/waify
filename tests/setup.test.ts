import { describe, it, expect } from 'vitest'
import { promptScheduleJobs } from '../src/cli/commands/setup.ts'

const createMockPrompt = (answers: string[]) => {
  let index = 0
  return async (_question: string): Promise<string> => answers[index++] ?? ''
}

describe('promptScheduleJobs', () => {
  it('returns one job when user declines to add more', async () => {
    const promptFn = createMockPrompt(['my-job', '0 0 9 * * *', 'n'])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ name: 'my-job', schedule: '0 0 9 * * *', command: 'send' })
  })

  it('returns one job when user presses enter (default N)', async () => {
    const promptFn = createMockPrompt(['my-job', '0 0 9 * * *', ''])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs).toHaveLength(1)
  })

  it('collects two jobs when user enters y then n', async () => {
    const promptFn = createMockPrompt([
      'job-one', '0 0 9 * * *', 'y',
      'job-two', '0 0 19 * * *', 'n',
    ])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs).toHaveLength(2)
    expect(jobs[1]).toMatchObject({ name: 'job-two', schedule: '0 0 19 * * *' })
  })

  it('re-prompts on invalid name and accepts the corrected one', async () => {
    const promptFn = createMockPrompt(['Invalid Name!', 'valid-name', '0 0 9 * * *', 'n'])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs[0]!.name).toBe('valid-name')
  })

  it('re-prompts on invalid cron and accepts the corrected one', async () => {
    const promptFn = createMockPrompt(['my-job', '0 9 * * *', '0 0 9 * * *', 'n'])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs[0]!.schedule).toBe('0 0 9 * * *')
  })
})
