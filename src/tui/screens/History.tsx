import { Box, Text, useInput } from 'ink'
import { useMemo, useState } from 'react'
import { readHistory } from '../../core/logger.ts'

const PAGE_SIZE = 15

export const History = () => {
  const entries = useMemo(() => readHistory(), [])
  const [offset, setOffset] = useState(Math.max(0, entries.length - PAGE_SIZE))

  useInput((input, key) => {
    if (key.upArrow || input === 'k') setOffset((o) => Math.max(0, o - 1))
    if (key.downArrow || input === 'j') setOffset((o) => Math.min(Math.max(0, entries.length - PAGE_SIZE), o + 1))
    if (key.pageUp) setOffset((o) => Math.max(0, o - PAGE_SIZE))
    if (key.pageDown) setOffset((o) => Math.min(Math.max(0, entries.length - PAGE_SIZE), o + PAGE_SIZE))
  })

  const slice = entries.slice(offset, offset + PAGE_SIZE)

  return (
    <Box flexDirection="column">
      <Text bold>History ({entries.length} entries)</Text>
      <Text dimColor>↑/↓ or j/k scroll · PgUp/PgDn page</Text>
      <Box marginTop={1} flexDirection="column">
        {slice.length === 0 ? (
          <Text dimColor>(no entries yet)</Text>
        ) : (
          slice.map((e, i) => (
            <Text key={offset + i}>
              <Text dimColor>{e.timestamp}</Text>{' '}
              <Text color={e.status === 'sent' ? 'green' : 'red'}>{e.status}</Text>{' '}
              {e.detail}
            </Text>
          ))
        )}
      </Box>
      <Text dimColor>showing {offset + 1}-{Math.min(offset + PAGE_SIZE, entries.length)} of {entries.length}</Text>
    </Box>
  )
}
