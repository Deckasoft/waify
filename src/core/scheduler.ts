import { spawn } from 'child_process'
import { composePath } from './paths.ts'

export type RestartResult = { ok: boolean; output: string }

// Restart the Ofelia scheduler to apply changes. `up -d --force-recreate`
// reliably picks up both ofelia.ini edits (job changes) and the scheduler's TZ
// env (timezone changes), and only touches the scheduler — never openwa-api,
// so the WhatsApp session is left alone. Async so the Ink TUI stays responsive.
export const restartScheduler = (): Promise<RestartResult> =>
  new Promise((resolve) => {
    const child = spawn('docker', [
      'compose',
      '-f',
      composePath(),
      'up',
      '-d',
      '--force-recreate',
      'scheduler',
    ])
    const chunks: Buffer[] = []
    const collect = (data: Buffer): number => chunks.push(data)
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)
    child.on('error', (err) => resolve({ ok: false, output: err.message }))
    child.on('close', (code) =>
      resolve({ ok: code === 0, output: Buffer.concat(chunks).toString().trim() }),
    )
  })
