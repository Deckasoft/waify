import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { z } from 'zod'
import { configPath } from './paths.ts'

const RecipientSchema = z.object({
  chatId: z.string(),
  name: z.string().optional(),
})

export type Recipient = z.infer<typeof RecipientSchema>

// Curated language choices offered in setup + the TUI (plus a free-text 'Other').
export const LANGUAGES = ['Spanish', 'English', 'Portuguese', 'French', 'German', 'Italian'] as const

// IANA zone list (e.g. 'America/Guayaquil'). Used to validate config and to
// populate the timezone picker. 'UTC' is always included — it's the default and
// some ICU builds omit it from supportedValuesOf.
export const supportedTimezones = (): string[] => {
  const supportedValuesOf = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
  const zones = supportedValuesOf ? supportedValuesOf('timeZone') : []
  return zones.includes('UTC') ? zones : ['UTC', ...zones]
}

// The host's IANA timezone, used as the setup/TUI default.
export const detectTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const isValidTimezone = (tz: string): boolean => supportedTimezones().includes(tz)

export const ConfigSchema = z.object({
  openwaBaseUrl: z.string().url().default('http://localhost:2785'),
  openwaSessionId: z.string().nullable().default(null),
  recipients: z.array(RecipientSchema).max(1).default([]),
  // Human language name (e.g. 'Spanish') injected into the generation prompt.
  language: z.string().min(1).default('Spanish'),
  // IANA timezone the Ofelia scheduler evaluates cron in (via the TZ env).
  timezone: z
    .string()
    .min(1)
    .refine(isValidTimezone, { message: 'timezone must be a valid IANA zone (e.g. America/Guayaquil)' })
    .default('UTC'),
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
