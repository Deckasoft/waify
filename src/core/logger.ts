import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { dirname } from 'path'
import { logPath } from './paths.ts'

export type LogStatus = 'sent' | 'error'

export type LogEntry = {
  timestamp: string
  status: LogStatus
  detail: string
}

export const log = (status: LogStatus, detail: string): void => {
  const path = logPath()
  mkdirSync(dirname(path), { recursive: true })
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${status.toUpperCase()} | ${detail}\n`
  appendFileSync(path, line, 'utf-8')
}

const LINE_RE = /^\[([^\]]+)\]\s+(sent|error)\s+\|\s+(.*)$/

const parseLine = (line: string): LogEntry | null => {
  const match = LINE_RE.exec(line)
  if (!match) return null
  const [, timestamp, status, detail] = match
  if (!timestamp || !status || detail === undefined) return null
  return { timestamp, status: status as LogStatus, detail }
}

export const readHistory = (limit?: number): readonly LogEntry[] => {
  const path = logPath()
  if (!existsSync(path)) return []
  const lines = readFileSync(path, 'utf-8')
    .split('\n')
    .filter((l) => l.length > 0)
  const entries = lines
    .map(parseLine)
    .filter((e): e is LogEntry => e !== null)
  return limit ? entries.slice(-limit) : entries
}
