import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}))

describe('generateMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['GEMINI_API_KEY'] = 'test-key'
  })

  it('calls Gemini with the correct model and returns trimmed text', async () => {
    mockGenerateContent.mockResolvedValue({ text: '  ¡Hoy es un gran día para ti!  ' })

    const { generateMessage } = await import('../src/generateMessage.ts')
    const result = await generateMessage()

    expect(result).toBe('¡Hoy es un gran día para ti!')

    const callArgs = mockGenerateContent.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArgs['model']).toBe('gemini-2.5-flash')
    expect((callArgs['config'] as Record<string, string>)['systemInstruction']).toContain('Spanish')
  })

  it('throws when response text is empty', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' })

    const { generateMessage } = await import('../src/generateMessage.ts')
    await expect(generateMessage()).rejects.toThrow('Unexpected empty response')
  })

  it('throws when the API call fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API error'))

    const { generateMessage } = await import('../src/generateMessage.ts')
    await expect(generateMessage()).rejects.toThrow('API error')
  })
})
