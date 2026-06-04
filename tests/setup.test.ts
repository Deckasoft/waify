import { afterEach, describe, it, expect } from 'vitest'
import { composeTemplate, promptScheduleJobs } from '../src/cli/commands/setup.ts'

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

describe('composeTemplate', () => {
  afterEach(() => {
    delete process.env['WAIFY_DATA_DIR']
  })

  it('defines the Ofelia scheduler service', () => {
    expect(composeTemplate()).toContain('scheduler:')
    expect(composeTemplate()).toContain('image: mcuadros/ofelia:latest')
    expect(composeTemplate()).toContain('command: daemon --config=/etc/ofelia/config.ini')
  })

  it('mounts the docker socket and the generated ofelia.ini', () => {
    process.env['WAIFY_DATA_DIR'] = '/tmp/waify-test'
    const yml = composeTemplate()
    expect(yml).toContain('/var/run/docker.sock:/var/run/docker.sock')
    expect(yml).toContain('/tmp/waify-test/ofelia.ini:/etc/ofelia/config.ini:ro')
  })

  it('defines waify-network with a fixed name and attaches openwa-api to it', () => {
    const yml = composeTemplate()
    expect(yml).toContain('name: waify-network')
    // both services join the network
    expect(yml.match(/- waify-network/g)?.length).toBe(2)
  })
})
