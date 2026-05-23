import type { Command } from 'commander'
import { assertConfigReady, loadConfig } from '../../core/config.ts'
import { loadSecrets } from '../../core/secrets.ts'
import { loadPrompt, generateMessage } from '../../core/prompt.ts'
import { sendMessage } from '../../core/sender.ts'
import { log } from '../../core/logger.ts'

export const registerSend = (program: Command): void => {
  program
    .command('send')
    .description('Generate a message via Gemini and send it via WhatsApp')
    .action(async () => {
      try {
        const secrets = loadSecrets()
        const config = loadConfig()
        assertConfigReady(config)
        const prompt = loadPrompt()
        const text = await generateMessage({ apiKey: secrets.GEMINI_API_KEY, prompt })
        await sendMessage({
          baseUrl: config.openwaBaseUrl,
          apiKey: secrets.OPENWA_API_KEY,
          sessionId: config.openwaSessionId ?? '',
          chatId: config.wifeChatId ?? '',
          text,
        })
        log('sent', text.slice(0, 80))
        console.warn(`sent: ${text}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log('error', message)
        throw err
      }
    })
}
