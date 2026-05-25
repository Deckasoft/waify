import { describe, it, expect, afterEach } from 'vitest'
import { join } from 'path'
import { homedir } from 'os'
import { renderOfeliaIni, ScheduledJobSchema } from '../src/core/schedule.ts'

const makeSchedule = () => ({
  jobs: [{ name: 'test-job', schedule: '0 0 9 * * *', command: 'send' }],
})

describe('renderOfeliaIni default paths', () => {
  afterEach(() => {
    delete process.env['WAIFY_DATA_DIR']
    delete process.env['WAIFY_HOST_DATA_DIR']
    delete process.env['WAIFY_HOST_ENV_FILE']
    delete process.env['WAIFY_ENV_PATH']
  })

  it('defaults hostDataDir to ~/.config/waify', () => {
    const ini = renderOfeliaIni(makeSchedule())
    expect(ini).toContain(`volume = ${join(homedir(), '.config', 'waify')}:/data`)
  })

  it('defaults hostEnvFile to ~/.config/waify/.env', () => {
    const ini = renderOfeliaIni(makeSchedule())
    expect(ini).toContain(`volume = ${join(homedir(), '.config', 'waify', '.env')}:/app/.env:ro`)
  })

  it('respects WAIFY_DATA_DIR for both defaults', () => {
    process.env['WAIFY_DATA_DIR'] = '/tmp/waify-test'
    const ini = renderOfeliaIni(makeSchedule())
    expect(ini).toContain('volume = /tmp/waify-test:/data')
    expect(ini).toContain('volume = /tmp/waify-test/.env:/app/.env:ro')
  })

  it('respects WAIFY_HOST_DATA_DIR override', () => {
    process.env['WAIFY_HOST_DATA_DIR'] = '/custom/data'
    const ini = renderOfeliaIni(makeSchedule())
    expect(ini).toContain('volume = /custom/data:/data')
  })

  it('respects WAIFY_HOST_ENV_FILE override', () => {
    process.env['WAIFY_HOST_ENV_FILE'] = '/custom/.env'
    const ini = renderOfeliaIni(makeSchedule())
    expect(ini).toContain('volume = /custom/.env:/app/.env:ro')
  })
})

describe('ScheduledJobSchema cron validation', () => {
  const valid = (schedule: string) =>
    () => ScheduledJobSchema.parse({ name: 'job', schedule, command: 'send' })

  it('accepts a valid 6-field cron', () => {
    expect(valid('0 0 9 * * *')).not.toThrow()
  })

  it('accepts all-wildcard cron', () => {
    expect(valid('* * * * * *')).not.toThrow()
  })

  it('accepts step expressions', () => {
    expect(valid('*/5 * * * * *')).not.toThrow()
  })

  it('accepts range expressions', () => {
    expect(valid('0 0 9-17 * * 1-5')).not.toThrow()
  })

  it('rejects 5-field standard cron', () => {
    expect(valid('0 9 * * *')).toThrow('6-field')
  })

  it('rejects out-of-range seconds (60)', () => {
    expect(valid('60 0 9 * * *')).toThrow('6-field')
  })

  it('rejects out-of-range hours (24)', () => {
    expect(valid('0 0 24 * * *')).toThrow('6-field')
  })

  it('rejects out-of-range month (13)', () => {
    expect(valid('0 0 9 * 13 *')).toThrow('6-field')
  })

  it('rejects non-numeric non-wildcard field', () => {
    expect(valid('0 0 9 * abc *')).toThrow('6-field')
  })

  it('rejects invalid step expression', () => {
    expect(valid('*/abc * * * * *')).toThrow('6-field')
  })

  it('rejects incomplete range expression', () => {
    expect(valid('1- * * * * *')).toThrow('6-field')
  })
})
