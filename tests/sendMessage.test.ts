import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const baseArgs = {
  baseUrl: 'http://localhost:2785',
  apiKey: 'test-api-key',
  sessionId: 'test-session-id',
  chatId: '521234567890@c.us',
  text: 'Hola amor',
}

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs to the correct URL with the right headers and body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: 'abc123', timestamp: 1234567890 }),
    })

    const { sendMessage } = await import('../src/core/sender.ts')
    await sendMessage(baseArgs)

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]

    expect(url).toBe('http://localhost:2785/api/sessions/test-session-id/messages/send-text')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('test-api-key')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({
      chatId: '521234567890@c.us',
      text: 'Hola amor',
    })
  })

  it('throws when the response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Session not active',
    })

    const { sendMessage } = await import('../src/core/sender.ts')
    await expect(sendMessage(baseArgs)).rejects.toThrow('400')
  })

  it('throws when the response body does not match the schema', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: 'shape' }),
    })

    const { sendMessage } = await import('../src/core/sender.ts')
    await expect(sendMessage(baseArgs)).rejects.toThrow()
  })
})
