import { z } from 'zod'

const MessageResponseSchema = z.object({
  messageId: z.string(),
  timestamp: z.number(),
})

export type SendMessageArgs = {
  baseUrl: string
  apiKey: string
  sessionId: string
  chatId: string
  text: string
}

export const sendMessage = async ({
  baseUrl,
  apiKey,
  sessionId,
  chatId,
  text,
}: SendMessageArgs): Promise<void> => {
  const url = `${baseUrl}/api/sessions/${sessionId}/messages/send-text`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ chatId, text }),
  })

  if (!response.ok) {
    throw new Error(`OpenWA responded with ${response.status}: ${await response.text()}`)
  }

  const data: unknown = await response.json()
  MessageResponseSchema.parse(data)
}
