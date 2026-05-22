import 'dotenv/config'
import { z } from 'zod'
import { generateMessage } from './generateMessage.ts'
import { sendMessage } from './sendMessage.ts'
import { log } from './logger.ts'

const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  OPENWA_API_KEY: z.string().min(1),
  OPENWA_BASE_URL: z.string().url(),
  OPENWA_SESSION_ID: z.string().min(1),
  WIFE_CHAT_ID: z.string().min(1),
})

const run = async (): Promise<void> => {
  const env = EnvSchema.safeParse(process.env)
  if (!env.success) {
    const missing = env.error.errors.map((e) => e.path.join('.')).join(', ')
    throw new Error(`Missing or invalid env vars: ${missing}`)
  }

  const message = await generateMessage()
  await sendMessage(env.data.WIFE_CHAT_ID, message)
  log('sent', message.slice(0, 80))
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  log('error', message)
  process.exit(1)
})
