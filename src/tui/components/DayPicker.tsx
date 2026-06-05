import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import { DAY_LABELS } from '../../core/schedule.ts'

type Props = {
  onSubmit: (days: number[]) => void
  onCancel: () => void
}

// Toggle weekdays for a 'custom' schedule. Returns sorted DOW numbers (Sun=0).
export const DayPicker = ({ onSubmit, onCancel }: Props) => {
  const [cursor, setCursor] = useState(1)
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())

  useInput((input, key) => {
    if (key.escape) return onCancel()
    if (key.leftArrow) return setCursor((c) => Math.max(0, c - 1))
    if (key.rightArrow) return setCursor((c) => Math.min(DAY_LABELS.length - 1, c + 1))
    if (input === ' ') {
      return setSelected((s) => {
        const next = new Set(s)
        if (next.has(cursor)) next.delete(cursor)
        else next.add(cursor)
        return next
      })
    }
    if (key.return && selected.size > 0) {
      onSubmit([...selected].sort((a, b) => a - b))
    }
  })

  return (
    <Box flexDirection="column">
      <Box>
        {DAY_LABELS.map((d, i) => (
          <Text key={d} color={i === cursor ? 'cyan' : selected.has(i) ? 'green' : undefined}>
            {selected.has(i) ? `[${d}]` : ` ${d} `}{' '}
          </Text>
        ))}
      </Box>
      <Text dimColor>←/→ move · space toggle · enter confirm · esc cancel</Text>
    </Box>
  )
}
