import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

vi.mock('fs')

describe('log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('appends a line containing the timestamp, status, and detail', async () => {
    const { log } = await import('../src/logger.ts')

    const mockAppend = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => undefined)

    log('sent', 'Hoy el sol brilla más')

    expect(mockAppend).toHaveBeenCalledOnce()
    const [, line] = mockAppend.mock.calls[0] as [string, string, string]
    expect(line).toMatch(/^\[\d{4}-\d{2}-\d{2}T/)
    expect(line).toContain('sent')
    expect(line).toContain('Hoy el sol brilla más')
  })

  it('appends a line with status "error"', async () => {
    const { log } = await import('../src/logger.ts')

    const mockAppend = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => undefined)

    log('error', 'Connection refused')

    const [, line] = mockAppend.mock.calls[0] as [string, string, string]
    expect(line).toContain('error')
    expect(line).toContain('Connection refused')
  })
})
