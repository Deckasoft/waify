import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { readWaifyVersion } from '../src/core/version.ts'

describe('readWaifyVersion', () => {
  it('returns a semver-shaped string', () => {
    expect(readWaifyVersion()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('matches the version in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
    expect(readWaifyVersion()).toBe(pkg.version)
  })
})
