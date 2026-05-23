import { join } from 'path'
import { homedir } from 'os'

const dataDir = (): string =>
  process.env['WAIFY_DATA_DIR'] ?? join(homedir(), '.config', 'waify')

export const configPath = (): string => join(dataDir(), 'config.json')

export const promptPath = (): string => join(dataDir(), 'prompt.json')

export const scheduleJsonPath = (): string => join(dataDir(), 'schedule.json')

export const schedulePath = (): string => join(dataDir(), 'ofelia.ini')

export const logPath = (): string => join(dataDir(), 'messages.log')

export const envPath = (): string =>
  process.env['WAIFY_ENV_PATH'] ?? join(dataDir(), '.env')

export const composePath = (): string => join(dataDir(), 'docker-compose.yml')
