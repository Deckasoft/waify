export type AIProviderConfig = {
  apiKey: string
  model?: string
}

export type GenerateArgs = {
  systemPrompt: string
  examples: string[]
  language: string
}

export type AIProvider = {
  generateMessage: (args: GenerateArgs) => Promise<string>
}

export type CreateAIProvider = (config: AIProviderConfig) => AIProvider
