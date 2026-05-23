import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useEffect, useState } from 'react'
import { ConfigSchema, loadConfig, saveConfig } from '../../core/config.ts'
import { SecretsSchema, saveSecrets, tryLoadSecrets } from '../../core/secrets.ts'

type Field = {
  key: string
  label: string
  group: 'config' | 'secret' | 'recipient'
  value: string
  secret: boolean
}

const buildFields = (): Field[] => {
  const cfg = loadConfig()
  const secrets = tryLoadSecrets()
  return [
    { key: 'openwaBaseUrl', label: 'openwaBaseUrl', group: 'config', value: cfg.openwaBaseUrl, secret: false },
    { key: 'openwaSessionId', label: 'openwaSessionId', group: 'config', value: cfg.openwaSessionId ?? '', secret: false },
    { key: 'openwaApiKey', label: 'openwaApiKey', group: 'config', value: cfg.openwaApiKey ?? '', secret: false },
    { key: 'recipientChatId', label: 'recipients[0].chatId', group: 'recipient', value: cfg.recipients[0]?.chatId ?? '', secret: false },
    { key: 'GEMINI_API_KEY', label: 'GEMINI_API_KEY', group: 'secret', value: secrets.GEMINI_API_KEY ?? '', secret: true },
    { key: 'OPENWA_API_KEY', label: 'OPENWA_API_KEY', group: 'secret', value: secrets.OPENWA_API_KEY ?? '', secret: true },
  ]
}

type Props = {
  onFocusChange: (focused: boolean) => void
}

export const Settings = ({ onFocusChange }: Props) => {
  const [fields, setFields] = useState<Field[]>(buildFields)
  const [cursor, setCursor] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    onFocusChange(editing)
  }, [editing, onFocusChange])

  useInput((input, key) => {
    if (editing) {
      if (key.escape) {
        setEditing(false)
        setDraft('')
      }
      return
    }
    if (key.upArrow || input === 'k') setCursor((c) => Math.max(0, c - 1))
    if (key.downArrow || input === 'j') setCursor((c) => Math.min(fields.length - 1, c + 1))
    if (key.return || input === 'e') {
      const field = fields[cursor]
      if (field) {
        setDraft(field.value)
        setEditing(true)
      }
    }
  })

  const commit = (value: string) => {
    const field = fields[cursor]
    if (!field) return
    try {
      if (field.group === 'secret') {
        const parsed = SecretsSchema.partial().parse({ [field.key]: value })
        saveSecrets(parsed)
      } else if (field.group === 'recipient') {
        const cfg = loadConfig()
        const existing = cfg.recipients[0]
        const next = ConfigSchema.parse({
          ...cfg,
          recipients: [{ ...existing, chatId: value }],
        })
        saveConfig(next)
      } else {
        const cfg = loadConfig()
        const next = ConfigSchema.parse({ ...cfg, [field.key]: value || null })
        saveConfig(next)
      }
      setFields(buildFields())
      setMessage(`saved ${field.label}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    }
    setEditing(false)
    setDraft('')
  }

  const renderValue = (f: Field) => {
    if (!f.value) return <Text dimColor>(unset)</Text>
    if (f.secret) return <Text>{f.value.slice(0, 4)}…</Text>
    return <Text>{f.value}</Text>
  }

  return (
    <Box flexDirection="column">
      <Text bold>Settings</Text>
      <Text dimColor>↑/↓ to move · enter to edit · esc to cancel</Text>
      <Box marginTop={1} flexDirection="column">
        {fields.map((f, i) => (
          <Box key={f.key}>
            <Box width={24}>
              <Text color={i === cursor ? 'cyan' : undefined}>
                {i === cursor ? '▸ ' : '  '}
                {f.label}
              </Text>
            </Box>
            <Text> = </Text>
            {editing && i === cursor ? (
              <TextInput value={draft} onChange={setDraft} onSubmit={commit} />
            ) : (
              renderValue(f)
            )}
          </Box>
        ))}
      </Box>
      {message && (
        <Box marginTop={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}
    </Box>
  )
}
