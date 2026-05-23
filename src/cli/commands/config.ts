import type { Command } from 'commander'
import { ConfigSchema, loadConfig, saveConfig } from '../../core/config.ts'
import { SecretsSchema, saveSecrets, tryLoadSecrets } from '../../core/secrets.ts'

const SECRET_KEYS = new Set(Object.keys(SecretsSchema.shape))
// Exclude 'recipients' from the flat key list — it's a structured array.
// Expose it via the alias 'wifeChatId' for backward compat.
const CONFIG_KEYS = new Set(Object.keys(ConfigSchema.shape).filter((k) => k !== 'recipients'))

// Alias: 'wifeChatId' sets recipients[0].chatId
const ALIAS_KEYS = new Set(['wifeChatId'])

export const registerConfig = (program: Command): void => {
  const config = program.command('config').description('Inspect or update settings')

  config
    .command('list')
    .description('Print all config and secret keys (secrets masked)')
    .action(() => {
      const cfg = loadConfig()
      const secrets = tryLoadSecrets()

      console.warn('# config.json')
      Object.entries(cfg).forEach(([k, v]) => {
        if (k === 'recipients') {
          const chatId = cfg.recipients[0]?.chatId ?? '(unset)'
          console.warn(`  recipients[0].chatId = ${chatId}`)
        } else {
          console.warn(`  ${k} = ${v ?? '(unset)'}`)
        }
      })
      console.warn('\n# .env (secrets)')
      Array.from(SECRET_KEYS).forEach((k) => {
        const v = secrets[k as keyof typeof secrets]
        const display = v ? `${v.slice(0, 4)}…(${v.length} chars)` : '(unset)'
        console.warn(`  ${k} = ${display}`)
      })
    })

  config
    .command('get <key>')
    .description('Print a single config or secret value')
    .action((key: string) => {
      if (SECRET_KEYS.has(key)) {
        const secrets = tryLoadSecrets()
        const v = secrets[key as keyof typeof secrets]
        process.stdout.write((v ?? '') + '\n')
        return
      }
      if (ALIAS_KEYS.has(key)) {
        const cfg = loadConfig()
        process.stdout.write((cfg.recipients[0]?.chatId ?? '') + '\n')
        return
      }
      if (CONFIG_KEYS.has(key)) {
        const cfg = loadConfig()
        const v = cfg[key as keyof typeof cfg]
        process.stdout.write((v ?? '') + '\n')
        return
      }
      const knownKeys = [...CONFIG_KEYS, ...ALIAS_KEYS, ...SECRET_KEYS]
      throw new Error(`Unknown key: ${key}. Known keys: ${knownKeys.join(', ')}`)
    })

  config
    .command('set <key> <value>')
    .description('Update a config value (config.json) or secret (.env)')
    .action((key: string, value: string) => {
      if (SECRET_KEYS.has(key)) {
        saveSecrets({ [key]: value })
        console.warn(`updated secret: ${key}`)
        return
      }
      if (ALIAS_KEYS.has(key)) {
        // wifeChatId alias → recipients[0].chatId
        const cfg = loadConfig()
        const existing = cfg.recipients[0]
        const next = ConfigSchema.parse({
          ...cfg,
          recipients: [{ ...existing, chatId: value }],
        })
        saveConfig(next)
        console.warn(`updated config: recipients[0].chatId = ${value}`)
        return
      }
      if (CONFIG_KEYS.has(key)) {
        const cfg = loadConfig()
        const next = ConfigSchema.parse({ ...cfg, [key]: value })
        saveConfig(next)
        console.warn(`updated config: ${key} = ${value}`)
        return
      }
      const knownKeys = [...CONFIG_KEYS, ...ALIAS_KEYS, ...SECRET_KEYS]
      throw new Error(`Unknown key: ${key}. Known keys: ${knownKeys.join(', ')}`)
    })
}
