import { resolve } from 'path'
import { fileURLToPath } from 'url'

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../../')

export const dataDir = (): string => process.env['WAIFY_DATA_DIR'] ?? resolve(REPO_ROOT, 'data')

export const configPath = (): string => resolve(dataDir(), 'config.json')

export const promptPath = (): string => resolve(dataDir(), 'prompt.json')

export const schedulePath = (): string => resolve(dataDir(), 'ofelia.ini')

export const logPath = (): string => resolve(dataDir(), 'messages.log')

export const envPath = (): string =>
  process.env['WAIFY_ENV_PATH'] ?? resolve(REPO_ROOT, '.env')
