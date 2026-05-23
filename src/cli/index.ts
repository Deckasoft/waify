import 'dotenv/config'
import { Command } from 'commander'
import { registerInit } from './commands/init.ts'
import { registerSend } from './commands/send.ts'
import { registerPreview } from './commands/preview.ts'
import { registerHistory } from './commands/history.ts'
import { registerConfig } from './commands/config.ts'
import { registerPrompt } from './commands/prompt.ts'
import { registerSchedule } from './commands/schedule.ts'
import { registerTui } from './commands/tui.ts'

const program = new Command()

program
  .name('waify')
  .description('AI-powered daily message sender for WhatsApp')
  .version('0.1.0')

registerInit(program)
registerSend(program)
registerPreview(program)
registerHistory(program)
registerConfig(program)
registerPrompt(program)
registerSchedule(program)
registerTui(program)

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`error: ${message}`)
  process.exit(1)
})
