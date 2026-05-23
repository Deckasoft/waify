import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useEffect, useState } from 'react'
import { loadPrompt, savePrompt } from '../../core/prompt.ts'

type Props = {
  onFocusChange: (focused: boolean) => void
}

export const PromptScreen = ({ onFocusChange }: Props) => {
  const [prompt, setPrompt] = useState(loadPrompt)
  const [cursor, setCursor] = useState(0)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    onFocusChange(adding)
  }, [adding, onFocusChange])

  useInput((input, key) => {
    if (adding) {
      if (key.escape) {
        setAdding(false)
        setDraft('')
      }
      return
    }
    if (key.upArrow || input === 'k') setCursor((c) => Math.max(0, c - 1))
    if (key.downArrow || input === 'j') setCursor((c) => Math.min(prompt.examples.length - 1, c + 1))
    if (input === 'a') {
      setDraft('')
      setAdding(true)
    }
    if (input === 'd') {
      if (prompt.examples.length <= 1) {
        setMessage('cannot delete: at least one example required')
        return
      }
      const next = { ...prompt, examples: prompt.examples.filter((_, i) => i !== cursor) }
      savePrompt(next)
      setPrompt(next)
      setCursor((c) => Math.max(0, Math.min(next.examples.length - 1, c)))
      setMessage(`deleted example #${cursor + 1}`)
    }
  })

  const commit = (value: string) => {
    if (value.trim().length === 0) {
      setAdding(false)
      setDraft('')
      return
    }
    const next = { ...prompt, examples: [...prompt.examples, value.trim()] }
    savePrompt(next)
    setPrompt(next)
    setAdding(false)
    setDraft('')
    setMessage(`added example #${next.examples.length}`)
  }

  return (
    <Box flexDirection="column">
      <Text bold>Prompt</Text>
      <Text dimColor>system prompt is shown read-only here; edit via `wife prompt edit`</Text>

      <Box marginTop={1} borderStyle="single" paddingX={1} flexDirection="column">
        {prompt.systemPrompt.split('\n').map((line, i) => (
          <Text key={i} dimColor>{line || ' '}</Text>
        ))}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Examples ({prompt.examples.length})</Text>
        <Text dimColor>↑/↓ to move · [a]dd · [d]elete</Text>
        {prompt.examples.map((e, i) => (
          <Text key={i} color={i === cursor ? 'cyan' : undefined}>
            {i === cursor ? '▸ ' : '  '}
            {i + 1}. {e}
          </Text>
        ))}
        {adding && (
          <Box>
            <Text>+ </Text>
            <TextInput value={draft} onChange={setDraft} onSubmit={commit} />
          </Box>
        )}
      </Box>

      {message && (
        <Box marginTop={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}
    </Box>
  )
}
