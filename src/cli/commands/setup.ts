import type { Command } from 'commander'
import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { createInterface } from 'readline'
import qrcode from 'qrcode-terminal'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { z } from 'zod'
import { composePath, promptPath, scheduleJsonPath } from '../../core/paths.ts'
import { loadConfig, saveConfig } from '../../core/config.ts'
import { saveSecrets } from '../../core/secrets.ts'
import { defaultSchedule, saveSchedule } from '../../core/schedule.ts'
import { defaultPrompt, savePrompt } from '../../core/prompt.ts'

const SessionResponseSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
})

const SessionListSchema = z.array(SessionResponseSchema)

const QrResponseSchema = z.object({
  qrCode: z.string().optional(),
})

const StatusResponseSchema = z.object({
  status: z.string().optional(),
})

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const

const createSpinner = (message: string) => {
  let frame = 0
  const interval = setInterval(() => {
    process.stderr.write(`\r${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]} ${message}`)
    frame++
  }, 80)
  return {
    succeed: (msg: string) => { clearInterval(interval); process.stderr.write(`\r✓ ${msg}\n`) },
    fail: (msg: string) => { clearInterval(interval); process.stderr.write(`\r✗ ${msg}\n`) },
    stop: () => { clearInterval(interval); process.stderr.write('\r\x1b[K') },
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const fetchWithTimeout = (url: string, opts: RequestInit = {}, timeoutMs = 5000): Promise<Response> =>
  fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) })

const decodeQrDataUrl = (dataUrl: string): string | null => {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  const png = PNG.sync.read(buffer)
  const result = jsQR(new Uint8ClampedArray(png.data.buffer), png.width, png.height)
  return result?.data ?? null
}

const renderQrInTerminal = (dataUrl: string): Promise<void> =>
  new Promise((resolve) => {
    const raw = decodeQrDataUrl(dataUrl)
    if (raw) {
      qrcode.generate(raw, { small: true }, () => resolve())
    } else {
      console.warn('   (Could not decode QR image — try scanning from the API URL instead)')
      resolve()
    }
  })

const composeTemplate = (): string => `services:
  openwa-api:
    image: ghcr.io/deckasoft/openwa:latest
    ports:
      - '2785:2785'
    environment:
      - NODE_ENV=production
      - PORT=2785
      - DATABASE_TYPE=sqlite
      - DATABASE_SYNCHRONIZE=true
      - ENGINE_TYPE=whatsapp-web.js
      - SESSION_DATA_PATH=/app/data/sessions
      - PUPPETEER_HEADLESS=true
      - PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-gpu
      - STORAGE_TYPE=local
      - STORAGE_LOCAL_PATH=/app/data/media
      - QUEUE_ENABLED=false
      - REDIS_ENABLED=false
      - REDIS_BUILTIN=false
    volumes:
      - openwa-data:/app/data
    restart: unless-stopped

volumes:
  openwa-data:
`

const promptLine = (rl: ReturnType<typeof createInterface>, question: string): Promise<string> =>
  new Promise((resolve) => rl.question(question, resolve))

export const registerSetup = (program: Command): void => {
  program
    .command('setup')
    .description('Guided first-run wizard: installs OpenWA, authenticates WhatsApp, and configures waify')
    .action(async () => {
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      try {
        // Step 1 — Check Docker
        console.warn('Checking Docker...')
        const dockerCheck = spawnSync('docker', ['info'], { stdio: 'pipe' })
        if (dockerCheck.status !== 0) {
          console.error('Docker is not running or not installed. Please install Docker and start it before running setup.')
          process.exitCode = 1
          return
        }

        // Step 2 — Create config directory
        console.warn('Creating config directory...')
        mkdirSync(join(homedir(), '.config', 'waify'), { recursive: true })

        const baseUrl = loadConfig().openwaBaseUrl

        // Step 3 — Prompt for Gemini API key
        let geminiKey = ''
        while (!geminiKey.trim()) {
          geminiKey = await promptLine(
            rl,
            'Enter your Gemini API key (get one free at https://aistudio.google.com/apikey):\n> ',
          )
          if (!geminiKey.trim()) {
            console.warn('Gemini API key cannot be empty. Please try again.')
          }
        }

        // Step 4 — Prompt for recipient phone number
        let recipientNumber = ''
        const phoneRegex = /^\d{8,15}$/
        while (!phoneRegex.test(recipientNumber.trim())) {
          recipientNumber = await promptLine(
            rl,
            "Enter your recipient's WhatsApp number (e.g. 5511999998888 — digits only, no + or spaces):\n> ",
          )
          if (!phoneRegex.test(recipientNumber.trim())) {
            console.warn('Invalid number format. Use digits only, 8–15 characters. Please try again.')
          }
        }
        const chatId = `${recipientNumber.trim()}@c.us`

        // Save Gemini key and recipient immediately so a QR timeout doesn't lose user input
        saveSecrets({ GEMINI_API_KEY: geminiKey.trim(), OPENWA_API_KEY: '' })
        saveConfig({ ...loadConfig(), recipients: [{ chatId }] })

        // Step 5 — Write docker-compose.yml
        console.warn('Writing docker-compose.yml...')
        writeFileSync(composePath(), composeTemplate(), 'utf-8')

        // Step 6 — Start API container
        console.warn('Starting OpenWA containers (this may take a minute on first run)...')
        const upResult = spawnSync('docker', ['compose', '-f', composePath(), 'up', '-d', '--no-deps', 'openwa-api'], {
          stdio: 'inherit',
        })
        if (upResult.status !== 0) {
          console.error('Failed to start OpenWA containers. Check docker compose logs for details.')
          process.exitCode = 1
          return
        }

        // Step 7 — Wait for OpenWA API health check
        const apiSpinner = createSpinner('Waiting for OpenWA API to start...')
        let apiReady = false
        for (let attempt = 0; attempt < 30; attempt++) {
          try {
            const res = await fetchWithTimeout(`${baseUrl}/api/health`)
            if (res.status >= 200 && res.status < 300) {
              apiReady = true
              break
            }
          } catch {
            // not ready yet
          }
          await wait(2000)
        }
        if (!apiReady) {
          apiSpinner.fail(
            `OpenWA API did not become ready in time. Check logs with: docker compose -f ${composePath()} logs openwa-api`,
          )
          process.exitCode = 1
          return
        }
        apiSpinner.succeed('OpenWA API is ready')

        // Step 8 — Read the API key the server generated (production mode generates a random key)
        console.warn('Reading API key from container...')
        const keyResult = spawnSync(
          'docker',
          ['compose', '-f', composePath(), 'exec', '-T', 'openwa-api', 'cat', '/app/data/.api-key'],
          { encoding: 'utf-8' },
        )
        const openwaApiKey = keyResult.stdout?.trim()
        if (keyResult.status !== 0 || !openwaApiKey) {
          const errorMsg = keyResult.stderr?.trim() || 'Could not read API key from container.'
          throw new Error(`${errorMsg} Check logs with: docker compose -f ${composePath()} logs openwa-api`)
        }
        saveSecrets({ GEMINI_API_KEY: geminiKey.trim(), OPENWA_API_KEY: openwaApiKey })
        saveConfig({ ...loadConfig(), openwaApiKey, recipients: [{ chatId }] })

        // Step 9 — Create or retrieve existing WhatsApp session
        console.warn('Creating WhatsApp session...')
        const sessionRes = await fetchWithTimeout(`${baseUrl}/api/sessions`, {
          method: 'POST',
          headers: {
            'X-API-Key': openwaApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'waify' }),
        }, 10000)

        let sessionId: string
        if (sessionRes.status === 409) {
          // Session already exists from a previous run — look it up by name
          const listRes = await fetchWithTimeout(`${baseUrl}/api/sessions`, {
            headers: { 'X-API-Key': openwaApiKey },
          }, 10000)
          if (!listRes.ok) {
            throw new Error(`Failed to list sessions: ${listRes.status} ${listRes.statusText}`)
          }
          const sessions = SessionListSchema.parse(await listRes.json())
          const existing = sessions.find((s) => s.name === 'waify')
          if (!existing?.id) {
            throw new Error('Session "waify" already exists but could not be retrieved')
          }
          sessionId = existing.id
        } else if (!sessionRes.ok) {
          throw new Error(`Failed to create session: ${sessionRes.status} ${sessionRes.statusText}`)
        } else {
          const sessionData = SessionResponseSchema.parse(await sessionRes.json())
          sessionId = sessionData.id ?? sessionData.name ?? 'waify'
        }

        // Step 10 — Clear stale Chromium lock files left by a previous crashed run
        spawnSync(
          'docker',
          ['compose', '-f', composePath(), 'exec', '-T', 'openwa-api', 'sh', '-c',
           'rm -f /app/data/sessions/session-waify/Singleton*'],
          { encoding: 'utf-8' },
        )

        // Step 11 — Start session to initiate WhatsApp engine (400 = already started, that's ok)
        console.warn('Starting WhatsApp engine...')
        const startRes = await fetchWithTimeout(`${baseUrl}/api/sessions/${sessionId}/start`, {
          method: 'POST',
          headers: { 'X-API-Key': openwaApiKey },
        }, 10000)
        if (!startRes.ok && startRes.status !== 400) {
          throw new Error(`Failed to start session: ${startRes.status} ${startRes.statusText}`)
        }

        // Step 12 — Wait for QR code to be ready (Chromium cold-start can take >2 min on first run)
        const qrSpinner = createSpinner('Waiting for QR code (Chromium is starting)...')
        let qrCode: string | undefined
        for (let attempt = 0; attempt < 60; attempt++) {
          try {
            const qrRes = await fetchWithTimeout(`${baseUrl}/api/sessions/${sessionId}/qr`, {
              headers: { 'X-API-Key': openwaApiKey },
            })
            if (qrRes.ok) {
              const qrData = QrResponseSchema.parse(await qrRes.json())
              if (qrData.qrCode) {
                qrCode = qrData.qrCode
                break
              }
            }
          } catch {
            // not ready yet
          }
          await wait(2000)
        }
        qrSpinner.stop()

        console.warn('\n📱 Scan the QR code below with WhatsApp to link your device:')
        console.warn('   Settings → Linked Devices → Link a Device\n')
        if (qrCode) {
          await renderQrInTerminal(qrCode)
          console.warn('\n   (QR expires in ~20s — re-run setup if it expires before you scan)')
        } else {
          console.warn('   QR code was not ready in time. Re-run `waify setup` to try again.')
        }

        // Step 13 — Poll for WhatsApp connection
        const connectSpinner = createSpinner('Waiting for you to scan the QR code...')
        let connected = false
        for (let attempt = 0; attempt < 60; attempt++) {
          try {
            const statusRes = await fetchWithTimeout(`${baseUrl}/api/sessions/${sessionId}`, {
              headers: { 'X-API-Key': openwaApiKey },
            })
            const parsed = StatusResponseSchema.safeParse(await statusRes.json())
            if (!parsed.success) continue
            if (parsed.data.status === 'ready') {
              connected = true
              break
            }
          } catch {
            // keep polling
          }
          await wait(2000)
        }
        if (!connected) {
          connectSpinner.fail('WhatsApp did not connect within 2 minutes. Please re-run `waify setup` to try again.')
          process.exitCode = 1
          return
        }
        connectSpinner.succeed('WhatsApp connected!')

        // Step 14 — Persist session ID now that we have it
        saveConfig({ ...loadConfig(), openwaSessionId: sessionId })

        // Step 15 — Seed defaults
        if (!existsSync(promptPath())) {
          savePrompt(defaultPrompt)
        }
        if (!existsSync(scheduleJsonPath())) {
          saveSchedule(defaultSchedule)
        }

        // Step 16 — Done
        console.warn('\n✓ All done! Run `waify send` to send your first message.')
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err))
        process.exitCode = 1
      } finally {
        rl.close()
      }
    })
}
