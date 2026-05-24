import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs')
  return {
    ...actual,
    appendFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false),
  }
})

describe('log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('appends a line containing the timestamp, status, and detail', async () => {
    const { log } = await import('../src/core/logger.ts')
    log('sent', 'Hoy el sol brilla más')

    const append = vi.mocked(fs.appendFileSync)
    expect(append).toHaveBeenCalledOnce()
    const [, line] = append.mock.calls[0] as [string, string, string]
    expect(line).toMatch(/^\[\d{4}-\d{2}-\d{2}T/)
    expect(line).toContain('SENT')
    expect(line).toContain('Hoy el sol brilla más')
  })

  it('appends a line with status "error"', async () => {
    const { log } = await import('../src/core/logger.ts')
    log('error', 'Connection refused')

    const append = vi.mocked(fs.appendFileSync)
    const [, line] = append.mock.calls[0] as [string, string, string]
    expect(line).toContain('ERROR')
    expect(line).toContain('Connection refused')
  })
})
