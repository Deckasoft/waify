import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import QRCode from 'qrcode'
import * as fs from 'fs'
import { dirname } from 'path'

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs')
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

const KNOWN_QR_STRING = 'waify-qr-test-fixture'
let testDataUrl: string

beforeAll(async () => {
  const buffer = await QRCode.toBuffer(KNOWN_QR_STRING, { type: 'png', scale: 4 })
  testDataUrl = `data:image/png;base64,${buffer.toString('base64')}`
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env['WAIFY_DATA_DIR'] = '/tmp/waify-qr-test'
})

describe('decodeQrDataUrl', () => {
  it('round-trips a known string through PNG encode + decode', async () => {
    const { decodeQrDataUrl } = await import('../src/core/qr.ts')
    expect(decodeQrDataUrl(testDataUrl)).toBe(KNOWN_QR_STRING)
  })

  it('returns null when the payload is not a valid PNG', async () => {
    const { decodeQrDataUrl } = await import('../src/core/qr.ts')
    const garbage = `data:image/png;base64,${Buffer.from('not-a-png').toString('base64')}`
    expect(decodeQrDataUrl(garbage)).toBeNull()
  })
})

describe('saveQrImage', () => {
  it('writes decoded PNG bytes to qrImagePath() and returns the path', async () => {
    const { saveQrImage } = await import('../src/core/qr.ts')
    const { qrImagePath } = await import('../src/core/paths.ts')

    const result = saveQrImage(testDataUrl)

    expect(result).toBe(qrImagePath())
    const write = vi.mocked(fs.writeFileSync)
    expect(write).toHaveBeenCalledOnce()
    expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalledWith(
      dirname(qrImagePath()),
      { recursive: true },
    )
    const [path, bytes] = write.mock.calls[0] as [string, Buffer]
    expect(path).toBe(qrImagePath())
    const expected = Buffer.from(
      testDataUrl.replace(/^data:image\/\w+;base64,/, ''),
      'base64',
    )
    expect(Buffer.compare(bytes, expected)).toBe(0)
  })

  it('returns null and warns when writeFileSync throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
      throw new Error('disk full')
    })

    const { saveQrImage } = await import('../src/core/qr.ts')
    const result = saveQrImage(testDataUrl)

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('disk full'))
    warnSpy.mockRestore()
  })
})
