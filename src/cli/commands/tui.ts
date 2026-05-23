import type { Command } from 'commander'

export const registerTui = (program: Command): void => {
  program
    .command('tui')
    .description('Launch the interactive terminal UI')
    .action(async () => {
      const { startTui } = await import('../../tui/start.ts')
      await startTui()
    })
}
