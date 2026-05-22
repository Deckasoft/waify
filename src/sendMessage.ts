import { z } from 'zod'

const MessageResponseSchema = z.object({
  messageId: z.string(),
  timestamp: z.number(),
})

export const sendMessage = async (chatId: string, text: string): Promise<void> => {
  const baseUrl = process.env['OPENWA_BASE_URL']
  const apiKey = process.env['OPENWA_API_KEY']

  const sessionId = process.env['OPENWA_SESSION_ID']
  const url = `${baseUrl}/api/sessions/${sessionId}/messages/send-text`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey ?? '',
    },
    body: JSON.stringify({ chatId, text }),
  })

  if (!response.ok) {
    throw new Error(`OpenWA responded with ${response.status}: ${await response.text()}`)
  }

  const data: unknown = await response.json()
  MessageResponseSchema.parse(data)
}
