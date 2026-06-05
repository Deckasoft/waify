import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defaultPrompt } from '../src/core/prompt.ts'

const mockGenerateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}))

describe('generateMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls Gemini with the correct model and returns trimmed text', async () => {
    mockGenerateContent.mockResolvedValue({ text: '  ¡Hoy es un gran día para ti!  ' })

    const { generateMessage } = await import('../src/core/prompt.ts')
    const { createGeminiProvider } = await import('../src/core/providers/gemini.ts')
    const provider = createGeminiProvider({ apiKey: 'test-key' })
    const result = await generateMessage({ provider, prompt: defaultPrompt, language: 'Spanish' })

    expect(result).toBe('¡Hoy es un gran día para ti!')

    const callArgs = mockGenerateContent.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArgs['model']).toBe('gemini-2.5-flash')
    const instr = (callArgs['config'] as Record<string, string>)['systemInstruction']
    expect(instr).toContain('Write the message in Spanish')
    expect(instr).toContain('Here are examples')
  })

  it('injects the chosen language into the system instruction', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Have a great day!' })

    const { generateMessage } = await import('../src/core/prompt.ts')
    const { createGeminiProvider } = await import('../src/core/providers/gemini.ts')
    const provider = createGeminiProvider({ apiKey: 'k' })
    await generateMessage({ provider, prompt: defaultPrompt, language: 'English' })

    const callArgs = mockGenerateContent.mock.calls[0]?.[0] as Record<string, unknown>
    const instr = (callArgs['config'] as Record<string, string>)['systemInstruction']
    expect(instr).toContain('Write the message in English')
  })

  it('throws when response text is empty', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' })

    const { generateMessage } = await import('../src/core/prompt.ts')
    const { createGeminiProvider } = await import('../src/core/providers/gemini.ts')
    const provider = createGeminiProvider({ apiKey: 'k' })
    await expect(generateMessage({ provider, prompt: defaultPrompt, language: 'Spanish' })).rejects.toThrow(
      'Unexpected empty response',
    )
  })

  it('throws when the API call fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API error'))

    const { generateMessage } = await import('../src/core/prompt.ts')
    const { createGeminiProvider } = await import('../src/core/providers/gemini.ts')
    const provider = createGeminiProvider({ apiKey: 'k' })
    await expect(generateMessage({ provider, prompt: defaultPrompt, language: 'Spanish' })).rejects.toThrow(
      'API error',
    )
  })
})
