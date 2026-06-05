import type { Command } from 'commander'
import { loadConfig } from '../../core/config.ts'
import { SecretsSchema } from '../../core/secrets.ts'
import { loadPrompt, generateMessage } from '../../core/prompt.ts'
import { createGeminiProvider } from '../../core/providers/gemini.ts'

export const registerPreview = (program: Command): void => {
  program
    .command('preview')
    .description('Generate a candidate message and print it to stdout (no send)')
    .option('-n, --count <n>', 'generate N candidates', '1')
    .action(async ({ count }: { count: string }) => {
      // preview only generates (never sends), so validate just the Gemini key —
      // requiring OPENWA_API_KEY here would block previews when only Gemini is set.
      const { GEMINI_API_KEY } = SecretsSchema.pick({ GEMINI_API_KEY: true }).parse(process.env)
      const config = loadConfig()
      const prompt = loadPrompt()
      const provider = createGeminiProvider({ apiKey: GEMINI_API_KEY })
      const n = Math.max(1, parseInt(count, 10) || 1)

      const messages = await Promise.all(
        Array.from({ length: n }, () =>
          generateMessage({ provider, prompt, language: config.language, timezone: config.timezone }),
        ),
      )
      messages.forEach((m, i) => {
        if (n > 1) console.warn(`--- candidate ${i + 1} ---`)
        process.stdout.write(m + '\n')
      })
    })
}
