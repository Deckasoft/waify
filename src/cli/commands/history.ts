import type { Command } from 'commander'
import { readHistory } from '../../core/logger.ts'

export const registerHistory = (program: Command): void => {
  program
    .command('history')
    .description('Show entries from messages.log')
    .option('-n, --tail <n>', 'show only the last N entries')
    .option('-g, --grep <pattern>', 'filter entries by substring (case-insensitive)')
    .action(({ tail, grep }: { tail?: string; grep?: string }) => {
      const limit = tail ? Math.max(1, parseInt(tail, 10)) : undefined
      const entries = readHistory(limit)
      const filtered = grep
        ? entries.filter((e) => e.detail.toLowerCase().includes(grep.toLowerCase()))
        : entries

      if (filtered.length === 0) {
        console.warn('(no entries)')
        return
      }

      filtered.forEach((e) => {
        process.stdout.write(`[${e.timestamp}] ${e.status} | ${e.detail}\n`)
      })
    })
}
