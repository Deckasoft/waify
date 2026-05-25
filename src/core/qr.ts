import { mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { qrImagePath } from './paths.ts'

const stripDataUrlPrefix = (dataUrl: string): string =>
  dataUrl.replace(/^data:image\/\w+;base64,/, '')

export const decodeQrDataUrl = (dataUrl: string): string | null => {
  try {
    const buffer = Buffer.from(stripDataUrlPrefix(dataUrl), 'base64')
    const png = PNG.sync.read(buffer)
    const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    return result?.data ?? null
  } catch {
    return null
  }
}

export const saveQrImage = (dataUrl: string): string | null => {
  try {
    const buffer = Buffer.from(stripDataUrlPrefix(dataUrl), 'base64')
    const path = qrImagePath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, buffer)
    return path
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`Could not save QR image: ${msg}`)
    return null
  }
}
