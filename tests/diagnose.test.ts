import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LogEntry } from '../src/core/logger.ts'

// Mock all I/O dependencies before importing the module under test
vi.mock('../src/core/logger.ts', () => ({
  readHistory: vi.fn(),
}))

vi.mock('../src/core/schedule.ts', () => ({
  loadSchedule: vi.fn(() => ({ jobs: [{ name: 'test', schedule: '0 0 9 * * *', command: 'send' }] })),
  renderOfeliaIni: vi.fn(() => '[global]\nsave-folder = /tmp/ofelia\n\n[job-run "test"]\n'),
  regenerateOfeliaIni: vi.fn(),
}))

vi.mock('../src/core/scheduler.ts', () => ({
  restartScheduler: vi.fn(() => Promise.resolve({ ok: true, output: '' })),
}))

vi.mock('../src/core/paths.ts', () => ({
  composePath: vi.fn(() => '/mock/docker-compose.yml'),
  schedulePath: vi.fn(() => '/mock/ofelia.ini'),
  dataDir: vi.fn(() => '/mock'),
  dockerfilePath: vi.fn(() => '/mock/Dockerfile'),
  logPath: vi.fn(() => '/mock/messages.log'),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => '[global]\nsave-folder = /tmp/ofelia\n\n[job-run "test"]\n'),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
}))

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('../src/core/config.ts', () => ({
  loadConfig: vi.fn(() => ({
    openwaBaseUrl: 'http://localhost:2785',
    openwaSessionId: 'waify',
    recipients: [{ chatId: '5511999998888@c.us' }],
    language: 'Spanish',
    timezone: 'America/Sao_Paulo',
  })),
}))

vi.mock('../src/core/secrets.ts', () => ({
  loadSecrets: vi.fn(() => ({
    GEMINI_API_KEY: 'mock-gemini-key',
    OPENWA_API_KEY: 'mock-openwa-key',
  })),
}))

import { runDiagnostics } from '../src/core/diagnose.ts'
import { readHistory } from '../src/core/logger.ts'
import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { regenerateOfeliaIni } from '../src/core/schedule.ts'
import { restartScheduler } from '../src/core/scheduler.ts'

import type { ChildProcess } from 'child_process'

const makeSpawn = (code: number, stdout = '') => () => {
  const child = {
    stdout: { on: (event: string, cb: (data: Buffer) => void) => { if (event === 'data') process.nextTick(() => cb(Buffer.from(stdout))) } },
    stderr: { on: () => {} },
    on: (event: string, cb: (code: number) => void) => { if (event === 'close') process.nextTick(() => cb(code)) },
  } as unknown as ChildProcess
  return child
}

const mockFetchHealthySession = () => {
  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ status: 'ready' }) }) as typeof fetch
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(spawn).mockImplementation(makeSpawn(0, 'container-id-abc123'))
  vi.mocked(readHistory).mockReturnValue([
    { timestamp: '2026-06-11T09:00:00.000Z', status: 'sent', detail: 'Good morning!' },
  ] satisfies LogEntry[])
  vi.mocked(existsSync).mockReturnValue(true)
  vi.mocked(readFileSync).mockReturnValue('[global]\nsave-folder = /tmp/ofelia\n\n[job-run "test"]\n')
  mockFetchHealthySession()
})

describe('runDiagnostics', () => {
  describe('messages-log check', () => {
    it('returns ok when last entries are sent', async () => {
      const results = await runDiagnostics(false)
      const check = results.find((r) => r.name === 'messages-log')!
      expect(check.status).toBe('ok')
    })

    it('returns warn when no history exists', async () => {
      vi.mocked(readHistory).mockReturnValue([])
      const results = await runDiagnostics(false)
      const check = results.find((r) => r.name === 'messages-log')!
      expect(check.status).toBe('warn')
    })

    it('returns error when recent errors exist and includes detail', async () => {
      vi.mocked(readHistory).mockReturnValue([
        { timestamp: '2026-06-11T09:00:00.000Z', status: 'error', detail: 'OpenWA responded with 401: Unauthorized' },
        { timestamp: '2026-06-11T10:00:00.000Z', status: 'error', detail: 'OpenWA responded with 401: Unauthorized' },
      ] satisfies LogEntry[])
      const results = await runDiagnostics(false)
      const check = results.find((r) => r.name === 'messages-log')!
      expect(check.status).toBe('error')
      expect(check.detail).toContain('401')
    })
  })

  describe('docker-daemon check', () => {
    it('returns ok when docker info succeeds', async () => {
      const results = await runDiagnostics(false)
      const check = results.find((r) => r.name === 'docker-daemon')!
      expect(check.status).toBe('ok')
    })

    it('skips all docker checks when daemon is unreachable', async () => {
      vi.mocked(spawn).mockImplementation(makeSpawn(1, ''))
      const results = await runDiagnostics(false)
      expect(results.find((r) => r.name === 'docker-daemon')!.status).toBe('error')
      for (const name of ['openwa-api', 'scheduler', 'sender-image', 'ofelia-sync', 'scheduler-logs']) {
        const r = results.find((c) => c.name === name)!
        expect(r.status).toBe('error')
        expect(r.message).toContain('Skipped')
      }
    })
  })

  describe('ofelia-sync check', () => {
    it('returns ok when ofelia.ini matches expected output', async () => {
      const results = await runDiagnostics(false)
      expect(results.find((r) => r.name === 'ofelia-sync')!.status).toBe('ok')
    })

    it('returns error when ofelia.ini is out of sync without --fix', async () => {
      vi.mocked(readFileSync).mockReturnValue('outdated-content')
      const results = await runDiagnostics(false)
      const check = results.find((r) => r.name === 'ofelia-sync')!
      expect(check.status).toBe('error')
      expect(check.message).toContain('out of sync')
    })

    it('returns fixed when --fix regenerates and restarts scheduler', async () => {
      vi.mocked(readFileSync).mockReturnValue('outdated-content')
      const results = await runDiagnostics(true)
      const check = results.find((r) => r.name === 'ofelia-sync')!
      expect(check.status).toBe('fixed')
      expect(vi.mocked(regenerateOfeliaIni)).toHaveBeenCalled()
      expect(vi.mocked(restartScheduler)).toHaveBeenCalled()
    })

    it('returns error when ofelia.ini is missing and --fix is not passed', async () => {
      vi.mocked(existsSync).mockReturnValue(false)
      const results = await runDiagnostics(false)
      const check = results.find((r) => r.name === 'ofelia-sync')!
      expect(check.status).toBe('error')
      expect(check.message).toContain('missing')
    })
  })

  describe('api-health check', () => {
    it('returns ok when health endpoint responds 200', async () => {
      const results = await runDiagnostics(false)
      expect(results.find((r) => r.name === 'api-health')!.status).toBe('ok')
    })

    it('returns error when health endpoint is unreachable', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as typeof fetch
      const results = await runDiagnostics(false)
      const check = results.find((r) => r.name === 'api-health')!
      expect(check.status).toBe('error')
      expect(check.message).toContain('unreachable')
    })
  })

  describe('session-status check', () => {
    it('returns ok when session status is ready', async () => {
      const results = await runDiagnostics(false)
      expect(results.find((r) => r.name === 'session-status')!.status).toBe('ok')
    })

    it('returns error when session status is not ready', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ status: 'disconnected' }) }) as typeof fetch
      const results = await runDiagnostics(false)
      const check = results.find((r) => r.name === 'session-status')!
      expect(check.status).toBe('error')
      expect(check.message).toContain('disconnected')
    })
  })

  describe('overall', () => {
    it('returns exactly 9 results', async () => {
      const results = await runDiagnostics(false)
      expect(results).toHaveLength(9)
    })

    it('all checks pass when system is healthy', async () => {
      const results = await runDiagnostics(false)
      const failing = results.filter((r) => r.status === 'error')
      expect(failing).toHaveLength(0)
    })
  })
})
