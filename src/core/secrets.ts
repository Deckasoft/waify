import { existsSync, readFileSync, writeFileSync } from 'fs'
import { z } from 'zod'
import { envPath } from './paths.ts'

export const SecretsSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  OPENWA_API_KEY: z.string().min(1),
})

export type Secrets = z.infer<typeof SecretsSchema>

const parseEnvFile = (content: string): Record<string, string> =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .reduce<Record<string, string>>((acc, line) => {
      const eq = line.indexOf('=')
      if (eq === -1) return acc
      const key = line.slice(0, eq).trim()
      const value = line
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
      return { ...acc, [key]: value }
    }, {})

export const loadSecrets = (): Secrets => SecretsSchema.parse(process.env)

export const tryLoadSecrets = (): Partial<Secrets> => {
  const parsed = SecretsSchema.partial().safeParse(process.env)
  return parsed.success ? parsed.data : {}
}

export const saveSecrets = (next: Partial<Secrets>): void => {
  const path = envPath()
  const existing = existsSync(path) ? parseEnvFile(readFileSync(path, 'utf-8')) : {}
  const merged = { ...existing, ...next }
  const body = Object.entries(merged)
    .filter(([, v]) => typeof v === 'string' && v.length > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  writeFileSync(path, body + '\n', 'utf-8')
}
