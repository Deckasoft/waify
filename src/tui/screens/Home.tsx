import { Box, Text, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { useState } from 'react'
import { loadConfig, assertConfigReady } from '../../core/config.ts'
import { tryLoadSecrets } from '../../core/secrets.ts'
import { loadPrompt, generateMessage } from '../../core/prompt.ts'
import { createGeminiProvider } from '../../core/providers/gemini.ts'
import { sendMessage } from '../../core/sender.ts'
import { log, readHistory } from '../../core/logger.ts'
import { loadSchedule } from '../../core/schedule.ts'

type State =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'preview'; text: string }
  | { kind: 'sent'; text: string }
  | { kind: 'error'; message: string }

export const Home = () => {
  const [state, setState] = useState<State>({ kind: 'idle' })

  const cfg = loadConfig()
  const secrets = tryLoadSecrets()
  const schedule = loadSchedule()
  const history = readHistory(1)
  const lastSent = history[0]

  const hasSecrets = Boolean(secrets.GEMINI_API_KEY && secrets.OPENWA_API_KEY)
  const hasConfig = Boolean(cfg.openwaSessionId && cfg.recipients[0]?.chatId)

  const doPreview = async () => {
    if (!secrets.GEMINI_API_KEY) {
      setState({ kind: 'error', message: 'GEMINI_API_KEY missing in .env' })
      return
    }
    setState({ kind: 'busy', label: 'Generating preview' })
    try {
      const prompt = loadPrompt()
      const provider = createGeminiProvider({ apiKey: secrets.GEMINI_API_KEY })
      const text = await generateMessage({ provider, prompt })
      setState({ kind: 'preview', text })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const doSend = async () => {
    try {
      assertConfigReady(cfg)
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      return
    }
    if (!hasSecrets) {
      setState({ kind: 'error', message: 'Secrets missing in .env' })
      return
    }
    setState({ kind: 'busy', label: 'Generating + sending' })
    try {
      const prompt = loadPrompt()
      const provider = createGeminiProvider({ apiKey: secrets.GEMINI_API_KEY ?? '' })
      const text = await generateMessage({ provider, prompt })
      await sendMessage({
        baseUrl: cfg.openwaBaseUrl,
        apiKey: secrets.OPENWA_API_KEY ?? '',
        sessionId: cfg.openwaSessionId ?? '',
        chatId: cfg.recipients[0]?.chatId ?? '',
        text,
      })
      log('sent', text.slice(0, 80))
      setState({ kind: 'sent', text })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log('error', message)
      setState({ kind: 'error', message })
    }
  }

  useInput((input) => {
    if (state.kind === 'busy') return
    if (input === 'p') void doPreview()
    if (input === 's') void doSend()
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>Status</Text>
        <Text>  Secrets: {hasSecrets ? <Text color="green">ok</Text> : <Text color="red">missing</Text>}</Text>
        <Text>  Config:  {hasConfig ? <Text color="green">ok</Text> : <Text color="red">incomplete</Text>}</Text>
        <Text>  Jobs:    {schedule.jobs.length}</Text>
        <Text>  Last:    {lastSent ? `${lastSent.status} @ ${lastSent.timestamp}` : '(none)'}</Text>
      </Box>

      <Box flexDirection="column">
        <Text bold>Actions</Text>
        <Text>  [p] preview · [s] send now</Text>
      </Box>

      {state.kind === 'busy' && (
        <Text>
          <Spinner type="dots" /> {state.label}…
        </Text>
      )}
      {state.kind === 'preview' && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text bold color="yellow">preview</Text>
          <Text>{state.text}</Text>
        </Box>
      )}
      {state.kind === 'sent' && (
        <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
          <Text bold color="green">sent</Text>
          <Text>{state.text}</Text>
        </Box>
      )}
      {state.kind === 'error' && (
        <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1}>
          <Text bold color="red">error</Text>
          <Text>{state.message}</Text>
        </Box>
      )}
    </Box>
  )
}
