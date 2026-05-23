import { GoogleGenAI } from '@google/genai'
import type { CreateAIProvider } from './types.ts'

const composeSystemInstruction = (systemPrompt: string, examples: string[]): string => {
  const exampleLines = examples.map((e) => `- "${e}"`).join('\n')
  return [
    systemPrompt,
    '',
    'Here are examples of the exact tone and style to match:',
    exampleLines,
    '',
    'Output only the message text — no quotes, no labels, no explanations.',
  ].join('\n')
}

export const createGeminiProvider: CreateAIProvider = ({ apiKey, model = 'gemini-2.5-flash' }) => ({
  generateMessage: async (systemPrompt, examples) => {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model,
      contents: 'Send the message.',
      config: { systemInstruction: composeSystemInstruction(systemPrompt, examples) },
    })

    const text = response.text
    if (!text) {
      throw new Error('Unexpected empty response from Gemini')
    }
    return text.trim()
  },
})
