import { describe, it, expect, afterEach } from 'vitest'
import { join } from 'path'
import { homedir } from 'os'
import { qrImagePath } from '../src/core/paths.ts'

describe('qrImagePath', () => {
  afterEach(() => {
    delete process.env['WAIFY_DATA_DIR']
  })

  it('returns <WAIFY_DATA_DIR>/qr.png when WAIFY_DATA_DIR is set', () => {
    process.env['WAIFY_DATA_DIR'] = '/tmp/waify-test'
    expect(qrImagePath()).toBe('/tmp/waify-test/qr.png')
  })

  it('defaults to ~/.config/waify/qr.png when WAIFY_DATA_DIR is not set', () => {
    delete process.env['WAIFY_DATA_DIR']
    expect(qrImagePath()).toBe(join(homedir(), '.config', 'waify', 'qr.png'))
  })
})
