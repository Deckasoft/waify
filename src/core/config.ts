import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { z } from 'zod'
import { configPath } from './paths.ts'

export const ConfigSchema = z.object({
  openwaBaseUrl: z.string().url().default('http://openwa-api:2785'),
  openwaSessionId: z.string().nullable().default(null),
  wifeChatId: z.string().nullable().default(null),
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
  if (!config.wifeChatId) {
    throw new Error('wifeChatId is not set. Run `waify config set wifeChatId <id>` or use the TUI.')
  }
}
