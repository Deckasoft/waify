import { existsSync, readFileSync } from 'fs'
import { spawn } from 'child_process'
import { composePath, dataDir, dockerfilePath, schedulePath } from './paths.ts'
import { loadSchedule, renderOfeliaIni, regenerateOfeliaIni } from './schedule.ts'
import { restartScheduler } from './scheduler.ts'
import { readHistory } from './logger.ts'

export type CheckStatus = 'ok' | 'warn' | 'error' | 'fixed'

export type CheckResult = {
  name: string
  status: CheckStatus
  message: string
  detail?: string
}

const exec = (cmd: string, args: string[]): Promise<{ code: number; output: string }> =>
  new Promise((resolve) => {
    const child = spawn(cmd, args)
    const chunks: Buffer[] = []
    const collect = (data: Buffer): number => chunks.push(data)
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)
    child.on('error', (err) => resolve({ code: 1, output: err.message }))
    child.on('close', (code) =>
      resolve({ code: code ?? 1, output: Buffer.concat(chunks).toString().trim() }),
    )
  })

// Check 1: recent messages.log entries
const checkMessagesLog = (): CheckResult => {
  const entries = readHistory(20)
  if (entries.length === 0) {
    return { name: 'messages-log', status: 'warn', message: 'No message history found — no sends have been recorded yet' }
  }
  const errors = entries.filter((e) => e.status === 'error')
  if (errors.length === 0) {
    const last = entries[entries.length - 1]!
    return { name: 'messages-log', status: 'ok', message: `Last entry: ${last.status} at ${last.timestamp}` }
  }
  const recent = errors.slice(-3)
  return {
    name: 'messages-log',
    status: 'error',
    message: `${errors.length} error(s) in last 20 entries`,
    detail: recent.map((e) => `[${e.timestamp}] ${e.detail}`).join('\n'),
  }
}

// Check 2: Docker daemon accessible
const checkDockerDaemon = async (): Promise<CheckResult> => {
  const { code } = await exec('docker', ['info', '--format', '{{.ServerVersion}}'])
  if (code === 0) return { name: 'docker-daemon', status: 'ok', message: 'Docker daemon is running' }
  return {
    name: 'docker-daemon',
    status: 'error',
    message: 'Docker daemon is not reachable — start Docker Desktop or the Docker service',
  }
}

// Check 3: openwa-api container running
const checkOpenwaContainer = async (fix: boolean): Promise<CheckResult> => {
  const { code, output } = await exec('docker', [
    'compose', '-f', composePath(), 'ps', '--status', 'running', '--quiet', 'openwa-api',
  ])
  if (code === 0 && output.length > 0) {
    return { name: 'openwa-api', status: 'ok', message: 'openwa-api container is running' }
  }
  if (!fix) {
    return {
      name: 'openwa-api',
      status: 'error',
      message: 'openwa-api container is not running — run with --fix or: docker compose up -d openwa-api',
    }
  }
  const start = await exec('docker', ['compose', '-f', composePath(), 'up', '-d', 'openwa-api'])
  if (start.code !== 0) {
    return { name: 'openwa-api', status: 'error', message: 'Failed to start openwa-api', detail: start.output }
  }
  return { name: 'openwa-api', status: 'fixed', message: 'openwa-api container started' }
}

// Check 4: scheduler (Ofelia) container running
const checkSchedulerContainer = async (fix: boolean): Promise<CheckResult> => {
  const { code, output } = await exec('docker', [
    'compose', '-f', composePath(), 'ps', '--status', 'running', '--quiet', 'scheduler',
  ])
  if (code === 0 && output.length > 0) {
    return { name: 'scheduler', status: 'ok', message: 'Ofelia scheduler container is running' }
  }
  if (!fix) {
    return {
      name: 'scheduler',
      status: 'error',
      message: 'Ofelia scheduler is not running — run with --fix or restart manually',
    }
  }
  const result = await restartScheduler()
  if (!result.ok) {
    return { name: 'scheduler', status: 'error', message: 'Failed to start scheduler', detail: result.output }
  }
  return { name: 'scheduler', status: 'fixed', message: 'Ofelia scheduler started' }
}

// Check 5: sender image exists
const checkSenderImage = async (fix: boolean): Promise<CheckResult> => {
  const image = process.env['WAIFY_SENDER_IMAGE'] ?? 'openwa-scripts-sender:latest'
  const { code, output } = await exec('docker', ['images', image, '--format', '{{.ID}}'])
  if (code === 0 && output.length > 0) {
    return { name: 'sender-image', status: 'ok', message: `Sender image ${image} exists` }
  }
  if (!fix) {
    return {
      name: 'sender-image',
      status: 'error',
      message: `Sender image ${image} not found — run with --fix or: waify setup`,
    }
  }
  const df = dockerfilePath()
  if (!existsSync(df)) {
    return {
      name: 'sender-image',
      status: 'error',
      message: `Dockerfile not found at ${df} — run waify setup to regenerate it`,
    }
  }
  const build = await exec('docker', ['build', '-t', image, '-f', df, dataDir()])
  if (build.code !== 0) {
    return { name: 'sender-image', status: 'error', message: 'Failed to build sender image', detail: build.output }
  }
  return { name: 'sender-image', status: 'fixed', message: `Sender image ${image} built` }
}

// Check 6: ofelia.ini matches schedule.json
const checkOfeliaSync = async (fix: boolean): Promise<CheckResult> => {
  const iniPath = schedulePath()
  if (!existsSync(iniPath)) {
    if (!fix) {
      return { name: 'ofelia-sync', status: 'error', message: 'ofelia.ini is missing — run with --fix' }
    }
    regenerateOfeliaIni(loadSchedule())
    await restartScheduler()
    return { name: 'ofelia-sync', status: 'fixed', message: 'ofelia.ini generated and scheduler restarted' }
  }
  const current = readFileSync(iniPath, 'utf-8')
  const expected = renderOfeliaIni(loadSchedule())
  if (current === expected) {
    return { name: 'ofelia-sync', status: 'ok', message: 'ofelia.ini is in sync with schedule.json' }
  }
  if (!fix) {
    return {
      name: 'ofelia-sync',
      status: 'error',
      message: 'ofelia.ini is out of sync with schedule.json — run with --fix to regenerate',
    }
  }
  regenerateOfeliaIni(loadSchedule())
  const restart = await restartScheduler()
  if (!restart.ok) {
    return {
      name: 'ofelia-sync',
      status: 'error',
      message: 'ofelia.ini regenerated but scheduler restart failed',
      detail: restart.output,
    }
  }
  return { name: 'ofelia-sync', status: 'fixed', message: 'ofelia.ini regenerated and scheduler restarted' }
}

// Check 7: scheduler container logs for job errors
const checkSchedulerLogs = async (): Promise<CheckResult> => {
  const { code, output } = await exec('docker', [
    'compose', '-f', composePath(), 'logs', '--tail', '100', 'scheduler',
  ])
  if (code !== 0) {
    return { name: 'scheduler-logs', status: 'warn', message: 'Could not read scheduler logs (container may not exist yet)' }
  }
  if (output.length === 0) {
    return { name: 'scheduler-logs', status: 'warn', message: 'Scheduler has no log output yet' }
  }
  const lines = output.split('\n')
  const errorLines = lines.filter((l) =>
    /error|failed|exit code [^0]|panic/i.test(l) && !/level=info/i.test(l),
  )
  if (errorLines.length === 0) {
    return { name: 'scheduler-logs', status: 'ok', message: 'No errors found in scheduler logs' }
  }
  return {
    name: 'scheduler-logs',
    status: 'warn',
    message: `${errorLines.length} potential error line(s) in scheduler logs`,
    detail: errorLines.slice(-5).join('\n'),
  }
}

// Check 8: OpenWA API health endpoint
const checkApiHealth = async (baseUrl: string): Promise<CheckResult> => {
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) return { name: 'api-health', status: 'ok', message: `OpenWA API is healthy (${res.status})` }
    return {
      name: 'api-health',
      status: 'error',
      message: `OpenWA API returned ${res.status} — check: docker compose logs openwa-api`,
    }
  } catch (err) {
    return {
      name: 'api-health',
      status: 'error',
      message: `OpenWA API unreachable at ${baseUrl} — is the openwa-api container running?`,
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

// Check 9: WhatsApp session connected
const checkSessionStatus = async (
  baseUrl: string,
  apiKey: string,
  sessionId: string,
): Promise<CheckResult> => {
  if (!sessionId) {
    return { name: 'session-status', status: 'error', message: 'No session ID configured — run waify setup' }
  }
  try {
    const res = await fetch(`${baseUrl}/api/sessions/${sessionId}`, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      return {
        name: 'session-status',
        status: 'error',
        message: `Session API returned ${res.status} — the session may not exist`,
        detail: 'Run waify setup to create a new session',
      }
    }
    const data = (await res.json()) as { status?: string }
    if (data.status === 'ready') {
      return { name: 'session-status', status: 'ok', message: 'WhatsApp session is connected and ready' }
    }
    return {
      name: 'session-status',
      status: 'error',
      message: `WhatsApp session status is "${data.status ?? 'unknown'}" — re-run waify setup to reconnect`,
    }
  } catch (err) {
    return {
      name: 'session-status',
      status: 'error',
      message: 'Could not reach session status endpoint',
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

export const runDiagnostics = async (fix: boolean): Promise<CheckResult[]> => {
  const log = checkMessagesLog()
  const daemon = await checkDockerDaemon()
  const results: CheckResult[] = [log, daemon]

  if (daemon.status === 'error') {
    const skipped = ['openwa-api', 'scheduler', 'sender-image', 'ofelia-sync', 'scheduler-logs', 'api-health', 'session-status']
    return [
      ...results,
      ...skipped.map((name) => ({
        name,
        status: 'error' as CheckStatus,
        message: 'Skipped — Docker daemon not running',
      })),
    ]
  }

  results.push(
    await checkOpenwaContainer(fix),
    await checkSchedulerContainer(fix),
    await checkSenderImage(fix),
    await checkOfeliaSync(fix),
    await checkSchedulerLogs(),
  )

  try {
    const { loadConfig } = await import('./config.ts')
    const { loadSecrets } = await import('./secrets.ts')
    const config = loadConfig()
    const secrets = loadSecrets()
    results.push(
      await checkApiHealth(config.openwaBaseUrl),
      await checkSessionStatus(config.openwaBaseUrl, secrets.OPENWA_API_KEY, config.openwaSessionId ?? ''),
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    results.push(
      { name: 'api-health', status: 'error', message: `Config not loadable: ${msg} — run waify setup` },
      { name: 'session-status', status: 'error', message: 'Skipped — config not loadable' },
    )
  }

  return results
}
