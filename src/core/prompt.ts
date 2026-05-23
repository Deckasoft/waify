import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { z } from 'zod'
import type { AIProvider } from './providers/types.ts'
import { promptPath } from './paths.ts'

export const PromptSchema = z.object({
  systemPrompt: z.string().min(1),
  examples: z.array(z.string().min(1)).min(1),
})

export type Prompt = z.infer<typeof PromptSchema>

export const defaultPrompt: Prompt = {
  systemPrompt: [
    'You write short WhatsApp messages from a man to his partner to brighten her day.',
    'Write in casual, natural Spanish — the way a real person texts, not a greeting card.',
    'Keep it to 1–3 sentences. Vary the mood each time: sometimes sweet, sometimes a low-key hype, sometimes playful or funny, sometimes a quick inside-joke vibe, sometimes a chill inspirational nudge.',
    'Never sound formal, poetic, or like a motivational poster.',
    '',
    "Focus on lifting HER day — her strength, her mood, what's ahead for her. Avoid messages that are mostly about your own feelings or longing.",
  ].join('\n'),
  examples: [
    'Hoy vas a romperla, ya lo sé. Y si no, igual te quiero igual.',
    'Alerta científica: estudios demuestran que eres demasiado genial para un día normal. Actúa con precaución.',
    'Ya te debo un abrazo de esos buenos. Hoy te lo cobro.',
    'Hoy puede ponerse feo. Aguanta, que luego hay algo bueno. Probablemente yo.',
    'Oye, estoy convencido de que hoy vas a hacer algo increíble. Pero si no, tampoco pasa nada, igual eres mi favorita.',
    'No sé qué traiga el día, pero sé que tú puedes con lo que sea. Y si no, aquí estoy yo.',
  ],
}

export const loadPrompt = (): Prompt => {
  const path = promptPath()
  if (!existsSync(path)) return defaultPrompt
  const raw = readFileSync(path, 'utf-8')
  return PromptSchema.parse(JSON.parse(raw))
}

export const savePrompt = (prompt: Prompt): void => {
  const path = promptPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(prompt, null, 2) + '\n', 'utf-8')
}

export type GenerateMessageArgs = {
  provider: AIProvider
  prompt: Prompt
}

export const generateMessage = async ({ provider, prompt }: GenerateMessageArgs): Promise<string> =>
  provider.generateMessage(prompt.systemPrompt, prompt.examples)
