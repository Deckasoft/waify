import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useEffect, useState } from 'react'
import { ScheduledJobSchema, addJob, loadSchedule, removeJob } from '../../core/schedule.ts'

type AddStep = 'name' | 'cron'

type Props = {
  onFocusChange: (focused: boolean) => void
}

export const ScheduleScreen = ({ onFocusChange }: Props) => {
  const [schedule, setSchedule] = useState(loadSchedule)
  const [cursor, setCursor] = useState(0)
  const [addStep, setAddStep] = useState<AddStep | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftCron, setDraftCron] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    onFocusChange(addStep !== null)
  }, [addStep, onFocusChange])

  useInput((input, key) => {
    if (addStep !== null) {
      if (key.escape) {
        setAddStep(null)
        setDraftName('')
        setDraftCron('')
      }
      return
    }
    if (key.upArrow || input === 'k') setCursor((c) => Math.max(0, c - 1))
    if (key.downArrow || input === 'j') setCursor((c) => Math.min(schedule.jobs.length - 1, c + 1))
    if (input === 'a') {
      setDraftName('')
      setDraftCron('')
      setAddStep('name')
    }
    if (input === 'd') {
      const job = schedule.jobs[cursor]
      if (!job) return
      try {
        const next = removeJob(job.name)
        setSchedule(next)
        setCursor((c) => Math.max(0, Math.min(next.jobs.length - 1, c)))
        setMessage(`removed "${job.name}" — restart scheduler to apply`)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err))
      }
    }
  })

  const submitName = (value: string) => {
    if (value.trim().length === 0) {
      setAddStep(null)
      return
    }
    setDraftName(value.trim())
    setAddStep('cron')
  }

  const submitCron = (value: string) => {
    if (value.trim().length === 0) {
      setAddStep(null)
      setDraftName('')
      return
    }
    try {
      const job = ScheduledJobSchema.parse({ name: draftName, schedule: value.trim(), command: 'send' })
      const next = addJob(job)
      setSchedule(next)
      setMessage(`added "${job.name}" — restart scheduler to apply`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    }
    setAddStep(null)
    setDraftName('')
    setDraftCron('')
  }

  return (
    <Box flexDirection="column">
      <Text bold>Schedule</Text>
      <Text dimColor>↑/↓ to move · [a]dd · [d]elete · changes require: docker compose restart scheduler</Text>

      <Box marginTop={1} flexDirection="column">
        {schedule.jobs.length === 0 ? (
          <Text dimColor>(no jobs)</Text>
        ) : (
          schedule.jobs.map((j, i) => (
            <Text key={j.name} color={i === cursor ? 'cyan' : undefined}>
              {i === cursor ? '▸ ' : '  '}
              {j.name.padEnd(20)} {j.schedule.padEnd(16)} → {j.command}
            </Text>
          ))
        )}
        {addStep === 'name' && (
          <Box marginTop={1}>
            <Text>+ name: </Text>
            <TextInput value={draftName} onChange={setDraftName} onSubmit={submitName} />
          </Box>
        )}
        {addStep === 'cron' && (
          <Box marginTop={1}>
            <Text>+ {draftName} cron: </Text>
            <TextInput value={draftCron} onChange={setDraftCron} onSubmit={submitCron} placeholder="0 9 * * *" />
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
