import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { z } from 'zod'
import { dataDir, scheduleJsonPath as getScheduleJsonPath, schedulePath } from './paths.ts'

const CRON_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 59], // seconds
  [0, 59], // minutes
  [0, 23], // hours
  [1, 31], // day-of-month
  [1, 12], // month
  [0, 7],  // day-of-week
]

const STEP_RE = /^(\*|\d+)\/\d+$/
const RANGE_RE = /^\d+-\d+$/

// A single atom: '*', an integer in range, a range (N-M), or a step (N/M | */N).
const isValidCronAtom = (atom: string, [min, max]: readonly [number, number]): boolean => {
  if (atom === '*') return true
  if (STEP_RE.test(atom) || RANGE_RE.test(atom)) return true
  const n = Number(atom)
  return Number.isInteger(n) && n >= min && n <= max
}

// A field may be a comma-separated list of atoms (e.g. '0,6' or '1,3,5'), which
// Ofelia/cron support and the time builder emits for Weekends/Custom days.
const isValidCronField = (field: string, range: readonly [number, number]): boolean => {
  const atoms = field.split(',')
  return atoms.length > 0 && atoms.every((a) => a.length > 0 && isValidCronAtom(a, range))
}

export const isValidCron = (value: string): boolean => {
  const fields = value.trim().split(/\s+/)
  return fields.length === 6 && fields.every((f, i) => isValidCronField(f, CRON_RANGES[i]!))
}

// Day-of-week labels indexed by cron DOW number (Sun=0 … Sat=6).
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const DAY_LOOKUP: Record<string, number> = Object.fromEntries(
  DAY_LABELS.map((label, i) => [label.toLowerCase(), i]),
)

// Parse a custom-days string ('mon,wed,fri' or '1,3,5') into sorted unique DOW
// numbers, or null if any token is invalid. Accepts 3-letter names or 0–6.
export const parseDays = (input: string): number[] | null => {
  const tokens = input
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
  if (tokens.length === 0) return null
  const nums = tokens.map((t) => {
    if (t in DAY_LOOKUP) return DAY_LOOKUP[t]!
    const n = Number(t)
    return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null
  })
  if (nums.some((n) => n === null)) return null
  return [...new Set(nums as number[])].sort((a, b) => a - b)
}

export const FREQUENCIES = ['daily', 'weekdays', 'weekends', 'custom'] as const
export type Frequency = (typeof FREQUENCIES)[number]

export const CronBuilderSchema = z
  .object({
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    frequency: z.enum(FREQUENCIES),
    days: z.array(z.number().int().min(0).max(6)).optional(),
  })
  .refine((v) => v.frequency !== 'custom' || (v.days?.length ?? 0) > 0, {
    message: 'custom frequency requires at least one weekday',
  })

export type CronBuilderInput = z.infer<typeof CronBuilderSchema>

const dowField = (frequency: Frequency, days: number[] = []): string => {
  switch (frequency) {
    case 'daily':
      return '*'
    case 'weekdays':
      return '1-5'
    case 'weekends':
      return '0,6'
    case 'custom':
      return [...new Set(days)].sort((a, b) => a - b).join(',')
  }
}

// Generate a 6-field cron (seconds always 0) from a time + frequency. The
// schedule.json still stores plain cron, so Ofelia is unaffected.
export const buildCron = (input: CronBuilderInput): string => {
  const { hour, minute, frequency, days } = CronBuilderSchema.parse(input)
  return `0 ${minute} ${hour} * * ${dowField(frequency, days)}`
}

export const ScheduledJobSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'name must be lowercase alphanumeric with dashes'),
  schedule: z
    .string()
    .min(1)
    .refine(isValidCron, { message: 'schedule must be a 6-field cron expression (e.g. 0 0 9 * * *)' }),
  command: z.string().min(1).default('send'),
})

export type ScheduledJob = z.infer<typeof ScheduledJobSchema>

export const ScheduleSchema = z.object({
  jobs: z.array(ScheduledJobSchema),
})

export type Schedule = z.infer<typeof ScheduleSchema>

export const defaultSchedule: Schedule = {
  jobs: [
    { name: 'waify-morning', schedule: '0 0 9 * * *', command: 'send' },
    { name: 'waify-evening', schedule: '0 0 19 * * *', command: 'send' },
  ],
}

const scheduleJsonPath = getScheduleJsonPath

export const loadSchedule = (): Schedule => {
  const path = scheduleJsonPath()
  if (!existsSync(path)) return defaultSchedule
  const raw = readFileSync(path, 'utf-8')
  return ScheduleSchema.parse(JSON.parse(raw))
}

export const saveSchedule = (schedule: Schedule): void => {
  const path = scheduleJsonPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(schedule, null, 2) + '\n', 'utf-8')
  regenerateOfeliaIni(schedule)
}

export type OfeliaRuntime = {
  image: string
  network: string
  hostDataDir: string
  apiBaseUrl: string
}

const ofeliaRuntime = (): OfeliaRuntime => ({
  image: process.env['WAIFY_SENDER_IMAGE'] ?? 'openwa-scripts-sender:latest',
  network: process.env['WAIFY_NETWORK'] ?? 'waify-network',
  hostDataDir: process.env['WAIFY_HOST_DATA_DIR'] ?? dataDir(),
  apiBaseUrl: process.env['WAIFY_API_INTERNAL_URL'] ?? 'http://openwa-api:2785',
})

// Ofelia parses INI with gcfg, which splits each line on the FIRST `=` only, so
// the `=` between env KEY and VALUE needs no escaping. A backslash here is a hard
// gcfg parse error ("unquoted '\' must be followed by ...") that crash-loops the
// scheduler — emit the value verbatim.
const renderEnv = (key: string, value: string): string => `environment = ${key}=${value}`

const renderJob = (job: ScheduledJob, runtime: OfeliaRuntime): string =>
  [
    `[job-run "${job.name}"]`,
    `schedule = ${job.schedule}`,
    `image = ${runtime.image}`,
    `network = ${runtime.network}`,
    // The sender image is built locally, so Ofelia must not try to pull it
    // (default Pull=true → 404 pull access denied). See mcuadros/ofelia#55.
    `pull = false`,
    `command = ${job.command}`,
    // WAIFY_DATA_DIR points config/.env resolution at the mounted /data dir;
    // OPENWA_BASE_URL reaches the API by service name over waify-network
    // (the mounted config.json says localhost, which is wrong inside a container).
    renderEnv('WAIFY_DATA_DIR', '/data'),
    renderEnv('OPENWA_BASE_URL', runtime.apiBaseUrl),
    `volume = ${runtime.hostDataDir}:/data`,
  ].join('\n')

export const renderOfeliaIni = (schedule: Schedule, runtime: OfeliaRuntime = ofeliaRuntime()): string => {
  const header = [
    '# Generated by waify. Edit via TUI or `waify schedule` subcommands.',
    '# Restart the scheduler service after changes: docker compose restart scheduler',
    '',
    '[global]',
    'save-folder = /tmp/ofelia',
    '',
  ].join('\n')
  const body = schedule.jobs.map((j) => renderJob(j, runtime)).join('\n\n')
  return header + body + '\n'
}

export const regenerateOfeliaIni = (schedule: Schedule): void => {
  const path = schedulePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, renderOfeliaIni(schedule), 'utf-8')
}

export const addJob = (job: ScheduledJob): Schedule => {
  const current = loadSchedule()
  if (current.jobs.some((j) => j.name === job.name)) {
    throw new Error(`Job with name "${job.name}" already exists`)
  }
  const next = { jobs: [...current.jobs, job] }
  saveSchedule(next)
  return next
}

export const removeJob = (name: string): Schedule => {
  const current = loadSchedule()
  const next = { jobs: current.jobs.filter((j) => j.name !== name) }
  saveSchedule(next)
  return next
}
