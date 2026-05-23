import type { Command } from 'commander'
import { ConfigSchema, loadConfig, saveConfig } from '../../core/config.ts'
import { SecretsSchema, saveSecrets, tryLoadSecrets } from '../../core/secrets.ts'

const SECRET_KEYS = new Set(Object.keys(SecretsSchema.shape))
const CONFIG_KEYS = new Set(Object.keys(ConfigSchema.shape))

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
        console.warn(`  ${k} = ${v ?? '(unset)'}`)
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
      if (CONFIG_KEYS.has(key)) {
        const cfg = loadConfig()
        const v = cfg[key as keyof typeof cfg]
        process.stdout.write((v ?? '') + '\n')
        return
      }
      throw new Error(`Unknown key: ${key}. Known keys: ${[...CONFIG_KEYS, ...SECRET_KEYS].join(', ')}`)
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
      if (CONFIG_KEYS.has(key)) {
        const cfg = loadConfig()
        const next = ConfigSchema.parse({ ...cfg, [key]: value })
        saveConfig(next)
        console.warn(`updated config: ${key} = ${value}`)
        return
      }
      throw new Error(`Unknown key: ${key}. Known keys: ${[...CONFIG_KEYS, ...SECRET_KEYS].join(', ')}`)
    })
}
