import { GoogleGenAI } from '@google/genai'

const SYSTEM_PROMPT = `You write short WhatsApp messages from a man to his partner to brighten her day.
Write in casual, natural Spanish — the way a real person texts, not a greeting card.
Keep it to 1–3 sentences. Vary the mood each time: sometimes sweet, sometimes a low-key hype, sometimes playful or funny, sometimes a quick inside-joke vibe, sometimes a chill inspirational nudge.
Never sound formal, poetic, or like a motivational poster.

Focus on lifting HER day — her strength, her mood, what's ahead for her. Avoid messages that are mostly about your own feelings or longing.

Here are examples of the exact tone and style to match:
- "Hoy vas a romperla, ya lo sé. Y si no, igual te quiero igual."
- "Alerta científica: estudios demuestran que eres demasiado genial para un día normal. Actúa con precaución."
- "Ya te debo un abrazo de esos buenos. Hoy te lo cobro."
- "Hoy puede ponerse feo. Aguanta, que luego hay algo bueno. Probablemente yo."
- "Oye, estoy convencido de que hoy vas a hacer algo increíble. Pero si no, tampoco pasa nada, igual eres mi favorita."
- "No sé qué traiga el día, pero sé que tú puedes con lo que sea. Y si no, aquí estoy yo."

Output only the message text — no quotes, no labels, no explanations.`

export const generateMessage = async (): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY'] })

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Send the message.',
    config: { systemInstruction: SYSTEM_PROMPT },
  })

  const text = response.text
  if (!text) {
    throw new Error('Unexpected empty response from Gemini')
  }

  return text.trim()
}
