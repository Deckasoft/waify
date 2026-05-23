export type AIProviderConfig = {
  apiKey: string
  model?: string
}

export type AIProvider = {
  generateMessage: (systemPrompt: string, examples: string[]) => Promise<string>
}

export type CreateAIProvider = (config: AIProviderConfig) => AIProvider
