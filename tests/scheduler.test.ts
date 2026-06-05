import { describe, it, expect } from 'vitest'
import { schedulerUpArgs } from '../src/core/scheduler.ts'

describe('schedulerUpArgs', () => {
  const args = schedulerUpArgs('/etc/waify/docker-compose.yml')

  it('targets compose with the given file', () => {
    expect(args.slice(0, 3)).toEqual(['compose', '-f', '/etc/waify/docker-compose.yml'])
  })

  // Regression guard: Ofelia only reads ofelia.ini at container startup, so any
  // path that applies a schedule change MUST force-recreate the scheduler.
  // Plain `up -d` leaves a running scheduler on stale config (the setup re-run bug).
  it('force-recreates only the scheduler service', () => {
    expect(args).toContain('--force-recreate')
    expect(args).toContain('scheduler')
    expect(args).not.toContain('openwa-api')
  })

  it('runs detached', () => {
    expect(args).toContain('-d')
  })
})
