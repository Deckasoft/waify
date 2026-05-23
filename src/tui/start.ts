import 'dotenv/config'
import { render } from 'ink'
import { createElement } from 'react'
import { App } from './App.tsx'

export const startTui = async (): Promise<void> => {
  const instance = render(createElement(App))
  await instance.waitUntilExit()
}
