import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useEffect, useState } from 'react'
import {
  buildCron,
  ScheduledJobSchema,
  addJob,
  loadSchedule,
  removeJob,
  type Frequency,
} from '../../core/schedule.ts'
import { restartScheduler } from '../../core/scheduler.ts'
import { SelectList } from '../components/SelectList.tsx'
import { DayPicker } from '../components/DayPicker.tsx'

type AddStep = 'name' | 'time' | 'frequency' | 'days'

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

const FREQUENCY_BY_LABEL: Record<string, Frequency> = {
  Daily: 'daily',
  Weekdays: 'weekdays',
  Weekends: 'weekends',
  'Custom days': 'custom',
}
const FREQUENCY_LABELS = Object.keys(FREQUENCY_BY_LABEL)

type Props = {
  onFocusChange: (focused: boolean) => void
}

export const ScheduleScreen = ({ onFocusChange }: Props) => {
  const [schedule, setSchedule] = useState(loadSchedule)
  const [cursor, setCursor] = useState(0)
  const [addStep, setAddStep] = useState<AddStep | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftTime, setDraftTime] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    onFocusChange(addStep !== null)
  }, [addStep, onFocusChange])

  const resetAdd = () => {
    setAddStep(null)
    setDraftName('')
    setDraftTime('')
  }

  const applyRestart = async (note: string) => {
    setMessage(`${note} · restarting scheduler…`)
    const res = await restartScheduler()
    setMessage(
      res.ok
        ? `${note} · scheduler restarted`
        : `${note} · restart failed — run: docker compose up -d --force-recreate scheduler`,
    )
  }

  const finishAdd = async (cron: string) => {
    try {
      const job = ScheduledJobSchema.parse({ name: draftName, schedule: cron, command: 'send' })
      const next = addJob(job)
      setSchedule(next)
      resetAdd()
      await applyRestart(`added "${job.name}"`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
      resetAdd()
    }
  }

  const [hourStr, minuteStr] = draftTime.split(':')
  const hour = Number(hourStr)
  const minute = Number(minuteStr)

  useInput((input, key) => {
    if (addStep !== null) {
      if ((addStep === 'name' || addStep === 'time') && key.escape) resetAdd()
      return
    }
    if (key.upArrow || input === 'k') setCursor((c) => Math.max(0, c - 1))
    if (key.downArrow || input === 'j') setCursor((c) => Math.min(schedule.jobs.length - 1, c + 1))
    if (input === 'a') {
      setDraftName('')
      setDraftTime('')
      setAddStep('name')
    }
    if (input === 'd') {
      const job = schedule.jobs[cursor]
      if (!job) return
      try {
        const next = removeJob(job.name)
        setSchedule(next)
        setCursor((c) => Math.max(0, Math.min(next.jobs.length - 1, c)))
        void applyRestart(`removed "${job.name}"`)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err))
      }
    }
    if (input === 'r') void applyRestart('manual restart')
  })

  const submitName = (value: string) => {
    const name = value.trim()
    if (name.length === 0) return resetAdd()
    if (!/^[a-z0-9-]+$/.test(name)) {
      setMessage('Name must be lowercase letters, numbers, and dashes only.')
      return
    }
    setDraftName(name)
    setAddStep('time')
  }

  const submitTime = (value: string) => {
    const time = value.trim()
    if (time.length === 0) return resetAdd()
    if (!HHMM_RE.test(time)) {
      setMessage('Invalid time. Use 24h HH:MM, e.g. 09:00.')
      return
    }
    setDraftTime(time)
    setAddStep('frequency')
  }

  const onFrequency = (label: string) => {
    const frequency = FREQUENCY_BY_LABEL[label]
    if (!frequency) return
    if (frequency === 'custom') {
      setAddStep('days')
      return
    }
    void finishAdd(buildCron({ hour, minute, frequency }))
  }

  if (addStep === 'frequency') {
    return (
      <Box flexDirection="column">
        <Text bold>Schedule · {draftName} @ {draftTime} — frequency</Text>
        <SelectList items={FREQUENCY_LABELS} onSelect={onFrequency} onCancel={resetAdd} />
      </Box>
    )
  }

  if (addStep === 'days') {
    return (
      <Box flexDirection="column">
        <Text bold>Schedule · {draftName} @ {draftTime} — pick days</Text>
        <DayPicker
          onSubmit={(days) => void finishAdd(buildCron({ hour, minute, frequency: 'custom', days }))}
          onCancel={resetAdd}
        />
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold>Schedule</Text>
      <Text dimColor>↑/↓ move · [a]dd · [d]elete · [r] restart scheduler · changes auto-restart</Text>

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
        {addStep === 'time' && (
          <Box marginTop={1}>
            <Text>+ {draftName} time (HH:MM): </Text>
            <TextInput value={draftTime} onChange={setDraftTime} onSubmit={submitTime} placeholder="09:00" />
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
