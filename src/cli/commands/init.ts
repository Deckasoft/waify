import type { Command } from 'commander'
import { existsSync } from 'fs'
import { configPath, promptPath } from '../../core/paths.ts'
import { ConfigSchema, defaultConfig, saveConfig } from '../../core/config.ts'
import { defaultPrompt, savePrompt } from '../../core/prompt.ts'
import { defaultSchedule, saveSchedule } from '../../core/schedule.ts'

const migrateLegacyEnv = (): { changed: boolean; config: ReturnType<typeof defaultConfig> } => {
  const base = defaultConfig()
  // Migrate only user-specific identifiers. openwaBaseUrl defaults to the
  // in-Docker hostname (http://openwa-api:2785) — override with
  // `waify config set openwaBaseUrl http://localhost:2785` for local dev.
  const legacy = {
    openwaSessionId: process.env['OPENWA_SESSION_ID'],
    wifeChatId: process.env['WAIFY_CHAT_ID'],
  }
  const next = ConfigSchema.parse({
    openwaBaseUrl: base.openwaBaseUrl,
    openwaSessionId: legacy.openwaSessionId ?? base.openwaSessionId,
    wifeChatId: legacy.wifeChatId ?? base.wifeChatId,
  })
  const changed = Boolean(legacy.openwaSessionId || legacy.wifeChatId)
  return { changed, config: next }
}

export const registerInit = (program: Command): void => {
  program
    .command('init')
    .description('Seed data/config.json, data/prompt.json, and data/schedule.json with defaults')
    .option('--force', 'overwrite files even if they exist')
    .action(({ force }: { force?: boolean }) => {
      const migration = migrateLegacyEnv()

      const tasks: { label: string; exists: boolean; run: () => void; note?: string }[] = [
        {
          label: 'config.json',
          exists: existsSync(configPath()),
          run: () => saveConfig(migration.config),
          note: migration.changed ? '(migrated from .env legacy keys)' : undefined,
        },
        {
          label: 'prompt.json',
          exists: existsSync(promptPath()),
          run: () => savePrompt(defaultPrompt),
        },
        {
          label: 'schedule.json + ofelia.ini',
          exists: false,
          run: () => saveSchedule(defaultSchedule),
        },
      ]

      tasks.forEach((t) => {
        if (t.exists && !force) {
          console.warn(`skip ${t.label} (already exists; pass --force to overwrite)`)
          return
        }
        t.run()
        console.warn(`wrote ${t.label}${t.note ? ' ' + t.note : ''}`)
      })

      console.warn('\nNext steps:')
      console.warn('  1. Ensure .env has GEMINI_API_KEY and OPENWA_API_KEY')
      if (!migration.changed) {
        console.warn('  2. Set the runtime values:')
        console.warn('     waify config set openwaSessionId <uuid from openwa dashboard>')
        console.warn('     waify config set wifeChatId <countrycode+number>@c.us')
      } else {
        console.warn('  2. Verify migrated values: waify config list')
      }
      console.warn('  3. Test with `waify preview`, then `waify send`')
    })
}
