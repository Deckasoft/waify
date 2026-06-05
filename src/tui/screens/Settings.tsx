import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useEffect, useState } from 'react'
import { ConfigSchema, LANGUAGES, loadConfig, saveConfig, supportedTimezones } from '../../core/config.ts'
import { SecretsSchema, saveSecrets, tryLoadSecrets } from '../../core/secrets.ts'
import { writeCompose } from '../../core/compose.ts'
import { restartScheduler } from '../../core/scheduler.ts'
import { SelectList } from '../components/SelectList.tsx'

type FieldKind = 'text' | 'language' | 'timezone'

type Field = {
  key: string
  label: string
  group: 'config' | 'secret' | 'recipient'
  kind: FieldKind
  value: string
  secret: boolean
}

const buildFields = (): Field[] => {
  const cfg = loadConfig()
  const secrets = tryLoadSecrets()
  return [
    { key: 'openwaBaseUrl', label: 'openwaBaseUrl', group: 'config', kind: 'text', value: cfg.openwaBaseUrl, secret: false },
    { key: 'openwaSessionId', label: 'openwaSessionId', group: 'config', kind: 'text', value: cfg.openwaSessionId ?? '', secret: false },
    { key: 'recipientChatId', label: 'recipients[0].chatId', group: 'recipient', kind: 'text', value: cfg.recipients[0]?.chatId ?? '', secret: false },
    { key: 'language', label: 'language', group: 'config', kind: 'language', value: cfg.language, secret: false },
    { key: 'timezone', label: 'timezone', group: 'config', kind: 'timezone', value: cfg.timezone, secret: false },
    { key: 'GEMINI_API_KEY', label: 'GEMINI_API_KEY', group: 'secret', kind: 'text', value: secrets.GEMINI_API_KEY ?? '', secret: true },
    { key: 'OPENWA_API_KEY', label: 'OPENWA_API_KEY', group: 'secret', kind: 'text', value: secrets.OPENWA_API_KEY ?? '', secret: true },
  ]
}

type EditMode = 'none' | 'text' | 'language' | 'language-other' | 'timezone'

const LANGUAGE_OPTIONS = [...LANGUAGES, 'Other…'] as const

type Props = {
  onFocusChange: (focused: boolean) => void
}

export const Settings = ({ onFocusChange }: Props) => {
  const [fields, setFields] = useState<Field[]>(buildFields)
  const [cursor, setCursor] = useState(0)
  const [mode, setMode] = useState<EditMode>('none')
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    onFocusChange(mode !== 'none')
  }, [mode, onFocusChange])

  useInput((input, key) => {
    if (mode !== 'none') {
      if ((mode === 'text' || mode === 'language-other') && key.escape) {
        setMode('none')
        setDraft('')
      }
      return
    }
    if (key.upArrow || input === 'k') setCursor((c) => Math.max(0, c - 1))
    if (key.downArrow || input === 'j') setCursor((c) => Math.min(fields.length - 1, c + 1))
    if (key.return || input === 'e') {
      const field = fields[cursor]
      if (!field) return
      if (field.kind === 'language') setMode('language')
      else if (field.kind === 'timezone') setMode('timezone')
      else {
        setDraft(field.value)
        setMode('text')
      }
    }
  })

  const saveConfigField = (key: string, value: string | null) => {
    saveConfig(ConfigSchema.parse({ ...loadConfig(), [key]: value }))
  }

  const finish = (msg: string) => {
    setFields(buildFields())
    setMessage(msg)
    setMode('none')
    setDraft('')
  }

  const commitText = (value: string) => {
    const field = fields[cursor]
    if (!field) return
    try {
      if (field.group === 'secret') {
        saveSecrets(SecretsSchema.partial().parse({ [field.key]: value }))
      } else if (field.group === 'recipient') {
        const cfg = loadConfig()
        saveConfig(ConfigSchema.parse({ ...cfg, recipients: [{ ...cfg.recipients[0], chatId: value }] }))
      } else {
        saveConfigField(field.key, value || null)
      }
      finish(`saved ${field.label}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
      setMode('none')
      setDraft('')
    }
  }

  const commitLanguage = (value: string) => {
    if (value === 'Other…') {
      setDraft('')
      setMode('language-other')
      return
    }
    const lang = value.trim()
    if (!lang) {
      // Empty custom submit → cancel without changing the saved language.
      setMode('none')
      setDraft('')
      return
    }
    try {
      saveConfigField('language', lang)
      finish(`saved language → ${lang}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
      setMode('none')
    }
  }

  const commitTimezone = async (value: string) => {
    setMode('none')
    try {
      saveConfigField('timezone', value)
      setFields(buildFields())
      writeCompose(value)
      setMessage(`timezone → ${value} · restarting scheduler…`)
      const res = await restartScheduler()
      setMessage(
        res.ok
          ? `timezone → ${value} · scheduler restarted`
          : `timezone saved · restart failed — run: docker compose up -d --force-recreate scheduler`,
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    }
  }

  if (mode === 'language') {
    return (
      <Box flexDirection="column">
        <Text bold>Settings · language</Text>
        <SelectList items={LANGUAGE_OPTIONS} onSelect={commitLanguage} onCancel={() => setMode('none')} />
      </Box>
    )
  }

  if (mode === 'timezone') {
    return (
      <Box flexDirection="column">
        <Text bold>Settings · timezone</Text>
        <SelectList
          items={supportedTimezones()}
          filterable
          onSelect={(v) => void commitTimezone(v)}
          onCancel={() => setMode('none')}
        />
      </Box>
    )
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
            {mode === 'text' && i === cursor ? (
              <TextInput value={draft} onChange={setDraft} onSubmit={commitText} />
            ) : mode === 'language-other' && i === cursor ? (
              <TextInput value={draft} onChange={setDraft} onSubmit={commitLanguage} placeholder="language name" />
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
