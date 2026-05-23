import type { Command } from 'commander'
import { loadSecrets } from '../../core/secrets.ts'
import { loadPrompt, generateMessage } from '../../core/prompt.ts'

export const registerPreview = (program: Command): void => {
  program
    .command('preview')
    .description('Generate a candidate message and print it to stdout (no send)')
    .option('-n, --count <n>', 'generate N candidates', '1')
    .action(async ({ count }: { count: string }) => {
      const secrets = loadSecrets()
      const prompt = loadPrompt()
      const n = Math.max(1, parseInt(count, 10) || 1)

      const messages = await Promise.all(
        Array.from({ length: n }, () => generateMessage({ apiKey: secrets.GEMINI_API_KEY, prompt })),
      )
      messages.forEach((m, i) => {
        if (n > 1) console.warn(`--- candidate ${i + 1} ---`)
        process.stdout.write(m + '\n')
      })
    })
}
