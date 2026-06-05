import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useState } from 'react'

type Props = {
  items: readonly string[]
  onSelect: (item: string) => void
  onCancel: () => void
  filterable?: boolean
  pageSize?: number
}

// Arrow-key select list with an optional type-to-filter box. Used for the
// language picker (short, no filter) and the timezone picker (filterable).
export const SelectList = ({ items, onSelect, onCancel, filterable = false, pageSize = 8 }: Props) => {
  const [filter, setFilter] = useState('')
  const [cursor, setCursor] = useState(0)

  const filtered = filter
    ? items.filter((i) => i.toLowerCase().includes(filter.toLowerCase()))
    : items
  const active = Math.min(cursor, Math.max(0, filtered.length - 1))

  useInput((_input, key) => {
    if (key.escape) return onCancel()
    if (key.upArrow) return setCursor((c) => Math.max(0, c - 1))
    if (key.downArrow) return setCursor((c) => Math.min(filtered.length - 1, c + 1))
    if (key.return) {
      const item = filtered[active]
      if (item) onSelect(item)
    }
  })

  const start = Math.max(
    0,
    Math.min(active - Math.floor(pageSize / 2), Math.max(0, filtered.length - pageSize)),
  )
  const view = filtered.slice(start, start + pageSize)

  return (
    <Box flexDirection="column">
      {filterable && (
        <Box>
          <Text>filter: </Text>
          <TextInput
            value={filter}
            onChange={(v) => {
              setFilter(v)
              setCursor(0)
            }}
          />
        </Box>
      )}
      {view.length === 0 ? (
        <Text dimColor>(no matches)</Text>
      ) : (
        view.map((item, i) => {
          const idx = start + i
          return (
            <Text key={item} color={idx === active ? 'cyan' : undefined}>
              {idx === active ? '▸ ' : '  '}
              {item}
            </Text>
          )
        })
      )}
      <Text dimColor>
        ↑/↓ move · enter select · esc cancel{filterable ? ' · type to filter' : ''}
      </Text>
    </Box>
  )
}
