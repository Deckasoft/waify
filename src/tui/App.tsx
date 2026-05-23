import { Box, Text, useApp, useInput } from 'ink'
import { useState } from 'react'
import { Home } from './screens/Home.tsx'
import { History } from './screens/History.tsx'
import { Settings } from './screens/Settings.tsx'
import { PromptScreen } from './screens/Prompt.tsx'
import { ScheduleScreen } from './screens/Schedule.tsx'

const TABS = [
  { key: '1', label: 'Home' },
  { key: '2', label: 'History' },
  { key: '3', label: 'Settings' },
  { key: '4', label: 'Prompt' },
  { key: '5', label: 'Schedule' },
] as const

type TabKey = (typeof TABS)[number]['key']

const TabBar = ({ active }: { active: TabKey }) => (
  <Box gap={2}>
    {TABS.map((t) => (
      <Text key={t.key} bold={t.key === active} color={t.key === active ? 'cyan' : undefined}>
        [{t.key}] {t.label}
      </Text>
    ))}
  </Box>
)

export const App = () => {
  const [tab, setTab] = useState<TabKey>('1')
  const [focused, setFocused] = useState(false)
  const { exit } = useApp()

  useInput((input) => {
    if (focused) return
    if (input === 'q') {
      exit()
      return
    }
    const found = TABS.find((t) => t.key === input)
    if (found) setTab(found.key)
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">wife</Text>
        <Text> — daily mood-lifter control panel</Text>
      </Box>
      <Box marginTop={1}>
        <TabBar active={tab} />
      </Box>
      <Box marginTop={1} flexDirection="column">
        {tab === '1' && <Home />}
        {tab === '2' && <History />}
        {tab === '3' && <Settings onFocusChange={setFocused} />}
        {tab === '4' && <PromptScreen onFocusChange={setFocused} />}
        {tab === '5' && <ScheduleScreen onFocusChange={setFocused} />}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>1-5 switch tabs · q quit{focused ? ' · esc to leave input' : ''}</Text>
      </Box>
    </Box>
  )
}
