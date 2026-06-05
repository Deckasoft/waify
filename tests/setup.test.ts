import { afterEach, describe, it, expect } from 'vitest'
import { promptScheduleJobs } from '../src/cli/commands/setup.ts'
import { composeTemplate } from '../src/core/compose.ts'

const createMockPrompt = (answers: string[]) => {
  let index = 0
  return async (_question: string): Promise<string> => answers[index++] ?? ''
}

describe('promptScheduleJobs', () => {
  // Builder flow per job: name, time (HH:MM), frequency choice (1-4), then "add another?".
  it('returns one daily job when user declines to add more', async () => {
    const promptFn = createMockPrompt(['my-job', '09:00', '1', 'n'])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ name: 'my-job', schedule: '0 0 9 * * *', command: 'send' })
  })

  it('returns one job when user presses enter (default daily + default N)', async () => {
    const promptFn = createMockPrompt(['my-job', '09:00', '', ''])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.schedule).toBe('0 0 9 * * *')
  })

  it('builds weekdays/weekends/custom crons from frequency choice', async () => {
    const weekdays = await promptScheduleJobs(createMockPrompt(['wd', '19:30', '2', 'n']))
    expect(weekdays[0]!.schedule).toBe('0 30 19 * * 1-5')
    const weekend = await promptScheduleJobs(createMockPrompt(['we', '08:05', '3', 'n']))
    expect(weekend[0]!.schedule).toBe('0 5 8 * * 0,6')
    const custom = await promptScheduleJobs(createMockPrompt(['cu', '07:00', '4', 'mon,wed,fri', 'n']))
    expect(custom[0]!.schedule).toBe('0 0 7 * * 1,3,5')
  })

  it('collects two jobs when user enters y then n', async () => {
    const promptFn = createMockPrompt([
      'job-one', '09:00', '1', 'y',
      'job-two', '19:00', '1', 'n',
    ])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs).toHaveLength(2)
    expect(jobs[1]).toMatchObject({ name: 'job-two', schedule: '0 0 19 * * *' })
  })

  it('re-prompts on invalid name and accepts the corrected one', async () => {
    const promptFn = createMockPrompt(['Invalid Name!', 'valid-name', '09:00', '1', 'n'])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs[0]!.name).toBe('valid-name')
  })

  it('re-prompts on invalid time and accepts the corrected one', async () => {
    const promptFn = createMockPrompt(['my-job', '9am', '09:00', '1', 'n'])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs[0]!.schedule).toBe('0 0 9 * * *')
  })
})

describe('composeTemplate', () => {
  afterEach(() => {
    delete process.env['WAIFY_DATA_DIR']
  })

  it('defines the Ofelia scheduler service', () => {
    expect(composeTemplate('UTC')).toContain('scheduler:')
    expect(composeTemplate('UTC')).toContain('image: mcuadros/ofelia:latest')
    expect(composeTemplate('UTC')).toContain('command: daemon --config=/etc/ofelia/config.ini')
  })

  it('mounts the docker socket and the generated ofelia.ini', () => {
    process.env['WAIFY_DATA_DIR'] = '/tmp/waify-test'
    const yml = composeTemplate('UTC')
    expect(yml).toContain('/var/run/docker.sock:/var/run/docker.sock')
    expect(yml).toContain('/tmp/waify-test/ofelia.ini:/etc/ofelia/config.ini:ro')
  })

  it('defines waify-network with a fixed name and attaches openwa-api to it', () => {
    const yml = composeTemplate('UTC')
    expect(yml).toContain('name: waify-network')
    // both services join the network
    expect(yml.match(/- waify-network/g)?.length).toBe(2)
  })

  it('bakes the chosen timezone into the scheduler TZ env', () => {
    expect(composeTemplate('America/Guayaquil')).toContain('TZ=America/Guayaquil')
  })
})
