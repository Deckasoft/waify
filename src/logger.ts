import { appendFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const LOG_PATH = resolve(fileURLToPath(import.meta.url), '../../messages.log')

export const log = (status: 'sent' | 'error', detail: string): void => {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${status} | ${detail}\n`
  appendFileSync(LOG_PATH, line, 'utf-8')
}
