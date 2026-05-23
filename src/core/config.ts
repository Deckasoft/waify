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

export const defaultConfig = (): Config => ConfigSchema.parse({})

export const loadConfig = (): Config => {
  const path = configPath()
  if (!existsSync(path)) return defaultConfig()
  const raw = readFileSync(path, 'utf-8')
  return ConfigSchema.parse(JSON.parse(raw))
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
