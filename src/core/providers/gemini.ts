import { GoogleGenAI } from '@google/genai'
import type { CreateAIProvider } from './types.ts'

const composeSystemInstruction = (
  systemPrompt: string,
  examples: string[],
  language: string,
  timeContext: string,
): string => {
  const exampleLines = examples.map((e) => `- "${e}"`).join('\n')
  return [
    systemPrompt,
    '',
    `Right now it is ${timeContext} for the recipient.`,
    'If your message opens with a time-of-day greeting, it MUST match that time of day; otherwise use no time-specific greeting. Never greet with the wrong part of day (e.g. no "good morning" at night).',
    '',
    'Here are examples of the exact tone and style to match:',
    exampleLines,
    '',
    `Write the message in ${language}, regardless of the language of the examples above.`,
    'Output only the message text — no quotes, no labels, no explanations.',
  ].join('\n')
}

export const createGeminiProvider: CreateAIProvider = ({ apiKey, model = 'gemini-2.5-flash' }) => ({
  generateMessage: async ({ systemPrompt, examples, language, timeContext }) => {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model,
      contents: 'Send the message.',
      config: { systemInstruction: composeSystemInstruction(systemPrompt, examples, language, timeContext) },
    })

    const text = response.text
    if (!text) {
      throw new Error('Unexpected empty response from Gemini')
    }
    return text.trim()
  },
})
