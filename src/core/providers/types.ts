export type AIProviderConfig = {
  apiKey: string
  model?: string
}

export type GenerateArgs = {
  systemPrompt: string
  examples: string[]
  language: string
  // Local time + part of day for the recipient, e.g. "22:00 (night)".
  timeContext: string
}

export type AIProvider = {
  generateMessage: (args: GenerateArgs) => Promise<string>
}

export type CreateAIProvider = (config: AIProviderConfig) => AIProvider
