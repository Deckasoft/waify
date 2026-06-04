import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { z } from 'zod'
import { configPath } from './paths.ts'

const RecipientSchema = z.object({
  chatId: z.string(),
  name: z.string().optional(),
})

export type Recipient = z.infer<typeof RecipientSchema>

export const ConfigSchema = z.object({
  openwaBaseUrl: z.string().url().default('http://localhost:2785'),
  openwaSessionId: z.string().nullable().default(null),
  openwaApiKey: z.string().nullable().default(null),
  recipients: z.array(RecipientSchema).max(1).default([]),
})

export type Config = z.infer<typeof ConfigSchema>

// OPENWA_BASE_URL lets a containerized run reach the API by service name
// (e.g. http://openwa-api:2785). Applied before parsing so the override is
// still validated by the schema; a plain default is insufficient because
// config.json already contains openwaBaseUrl, so the default never fires.
const parseConfig = (raw: unknown): Config => {
  const source = typeof raw === 'object' && raw !== null ? raw : {}
  const override = process.env['OPENWA_BASE_URL']
  return ConfigSchema.parse(override ? { ...source, openwaBaseUrl: override } : source)
}

export const defaultConfig = (): Config => parseConfig({})

export const loadConfig = (): Config => {
  const path = configPath()
  if (!existsSync(path)) return defaultConfig()
  return parseConfig(JSON.parse(readFileSync(path, 'utf-8')))
}

export const saveConfig = (config: Config): void => {
  const path = configPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

export const assertConfigReady = (config: Config): void => {
  if (!config.openwaSessionId) {
    throw new Error('openwaSessionId is not set. Run `waify config set openwaSessionId <id>` or use the TUI.')
  }
  const [recipient] = config.recipients
  if (!recipient?.chatId) {
    throw new Error('Run `waify setup` to configure a recipient')
  }
}
