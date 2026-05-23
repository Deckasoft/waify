import type { Command } from 'commander'
import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { createInterface } from 'readline'
import * as crypto from 'crypto'
import { z } from 'zod'
import qrcode from 'qrcode-terminal'
import { composePath, promptPath, scheduleJsonPath } from '../../core/paths.ts'
import { loadConfig, saveConfig } from '../../core/config.ts'
import { saveSecrets } from '../../core/secrets.ts'
import { defaultSchedule, saveSchedule } from '../../core/schedule.ts'
import { defaultPrompt, savePrompt } from '../../core/prompt.ts'

const SessionResponseSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
})

const QrResponseSchema = z.object({
  qr: z.string().optional(),
})

const StatusResponseSchema = z.object({
  status: z.string().optional(),
  connected: z.boolean().optional(),
})

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const composeTemplate = (openwaApiKey: string): string => `services:
  openwa-api:
    image: ghcr.io/deckasoft/openwa:latest
    ports:
      - '2785:3000'
    environment:
      - NODE_ENV=production
      - OPENWA_API_KEY=${openwaApiKey}
    volumes:
      - openwa-data:/app/data
    restart: unless-stopped

  openwa-dashboard:
    image: ghcr.io/deckasoft/openwa:latest
    ports:
      - '2786:4000'
    environment:
      - NODE_ENV=production
      - OPENWA_API_KEY=${openwaApiKey}
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
      // Step 1 — Check Docker
      console.warn('Checking Docker...')
      const dockerCheck = spawnSync('docker', ['info'], { stdio: 'pipe' })
      if (dockerCheck.status !== 0) {
        console.error('Docker is not running or not installed. Please install Docker and start it before running setup.')
        process.exit(1)
      }

      // Step 2 — Create config directory
      console.warn('Creating config directory...')
      mkdirSync(join(homedir(), '.config', 'waify'), { recursive: true })

      // Step 3 — Generate OpenWA API key
      console.warn('Generating credentials...')
      const openwaApiKey = crypto.randomUUID()

      // Step 4 — Write docker-compose.yml
      console.warn('Writing docker-compose.yml...')
      writeFileSync(composePath(), composeTemplate(openwaApiKey), 'utf-8')

      // Step 5 — Start containers
      console.warn('Starting OpenWA containers (this may take a minute on first run)...')
      const upResult = spawnSync('docker', ['compose', '-f', composePath(), 'up', '-d'], {
        stdio: 'inherit',
      })
      if (upResult.status !== 0) {
        console.error('Failed to start OpenWA containers. Check docker compose logs for details.')
        process.exit(1)
      }

      // Step 6 — Wait for OpenWA API
      console.warn('Waiting for OpenWA API to start...')
      let apiReady = false
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          const res = await fetch('http://localhost:2785/api')
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
        console.error(
          'OpenWA API did not become ready in time. Check logs with: docker compose -f ' +
            composePath() +
            ' logs openwa-api',
        )
        process.exit(1)
      }

      // Step 7 — Create WhatsApp session
      console.warn('Creating WhatsApp session...')
      const sessionRes = await fetch('http://localhost:2785/api/sessions', {
        method: 'POST',
        headers: {
          'X-API-Key': openwaApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'waify' }),
      })
      const sessionData = SessionResponseSchema.parse(await sessionRes.json())
      const sessionId =
        sessionData.id ??
        (sessionData.name as string | undefined) ??
        'waify'
      saveConfig({ ...loadConfig(), openwaApiKey, openwaSessionId: sessionId })

      // Step 8 — Display QR and poll for connection
      console.warn('📱 Scan the QR code below with WhatsApp on your phone:')
      console.warn('   (Settings → Linked Devices → Link a Device)')

      const qrRes = await fetch('http://localhost:2785/api/sessions/waify/qr', {
        headers: { 'X-API-Key': openwaApiKey },
      })
      const qrData = QrResponseSchema.parse(await qrRes.json())
      const rawQr = qrData.qr ?? ''
      const qrString = rawQr.startsWith('data:image/png;base64,')
        ? rawQr.slice('data:image/png;base64,'.length)
        : rawQr

      qrcode.generate(qrString, { small: true })
      console.warn('   Or open in browser: http://localhost:2786')

      let connected = false
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          const statusRes = await fetch('http://localhost:2785/api/sessions/waify', {
            headers: { 'X-API-Key': openwaApiKey },
          })
          const parsed = StatusResponseSchema.safeParse(await statusRes.json())
          if (!parsed.success) continue
          const statusData = parsed.data
          if (
            statusData.status === 'CONNECTED' ||
            statusData.connected === true
          ) {
            connected = true
            break
          }
        } catch {
          // keep polling
        }
        await wait(2000)
      }
      if (!connected) {
        console.error('WhatsApp did not connect within 2 minutes. Please re-run `waify setup` to try again.')
        process.exit(1)
      }
      console.warn('✓ WhatsApp connected!')

      // Step 9 — Prompt for Gemini API key
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      try {
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
        saveSecrets({ GEMINI_API_KEY: geminiKey.trim() })

        // Step 10 — Prompt for recipient
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
        saveConfig({ ...loadConfig(), recipients: [{ chatId }] })
      } finally {
        rl.close()
      }

      // Step 11 — Seed defaults
      if (!existsSync(promptPath())) {
        savePrompt(defaultPrompt)
      }
      if (!existsSync(scheduleJsonPath())) {
        saveSchedule(defaultSchedule)
      }

      // Step 12 — Done
      console.warn('✓ All done! Run `waify send` to send your first message.')
    })
}
