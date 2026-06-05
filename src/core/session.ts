export type StopSessionArgs = {
  baseUrl: string
  apiKey: string
  sessionId: string
}

// Disconnect WhatsApp by stopping the OpenWA session. Reconnecting later means
// re-running `waify setup` (scan the QR again).
export const stopSession = async ({ baseUrl, apiKey, sessionId }: StopSessionArgs): Promise<void> => {
  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/stop`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
  })
  if (!response.ok) {
    throw new Error(`OpenWA responded with ${response.status}: ${await response.text()}`)
  }
}
