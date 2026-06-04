import { afterEach, describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/core/config.ts'

describe('config OPENWA_BASE_URL override', () => {
  afterEach(() => {
    delete process.env['OPENWA_BASE_URL']
  })

  it('uses the schema default when the env var is unset', () => {
    expect(defaultConfig().openwaBaseUrl).toBe('http://localhost:2785')
  })

  it('lets OPENWA_BASE_URL override the base URL (for containerized runs)', () => {
    process.env['OPENWA_BASE_URL'] = 'http://openwa-api:2785'
    expect(defaultConfig().openwaBaseUrl).toBe('http://openwa-api:2785')
  })
})
