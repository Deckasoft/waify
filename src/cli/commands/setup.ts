import type { Command } from 'commander';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';
import qrcode from 'qrcode-terminal';
import { decodeQrDataUrl, saveQrImage } from '../../core/qr.ts';
import { z } from 'zod';
import { composePath, promptPath, scheduleJsonPath } from '../../core/paths.ts';
import { loadConfig, saveConfig } from '../../core/config.ts';
import { saveSecrets } from '../../core/secrets.ts';
import { isValidCron, saveSchedule, ScheduledJobSchema, type ScheduledJob } from '../../core/schedule.ts';
import { defaultPrompt, savePrompt } from '../../core/prompt.ts';

const SessionResponseSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
});

const SessionListSchema = z.array(SessionResponseSchema);

const QrResponseSchema = z.object({
  qrCode: z.string().optional(),
});

const StatusResponseSchema = z.object({
  status: z.string().optional(),
});

const SESSION_NAME = 'waify';

const SPINNER_FRAMES = [
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏',
] as const;

const createSpinner = (message: string) => {
  let current = message;
  let frame = 0;
  const interval = setInterval(() => {
    process.stderr.write(`\r${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]} ${current}`);
    frame++;
  }, 80).unref();
  return {
    update: (msg: string) => { current = msg; },
    succeed: (msg: string) => {
      clearInterval(interval);
      process.stderr.write(`\r✓ ${msg}\n`);
    },
    fail: (msg: string) => {
      clearInterval(interval);
      process.stderr.write(`\r✗ ${msg}\n`);
    },
    stop: () => {
      clearInterval(interval);
      process.stderr.write('\r\x1b[K');
    },
  };
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = (
  url: string,
  opts: RequestInit = {},
  timeoutMs = 5000,
): Promise<Response> =>
  fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });

const renderQrInTerminal = (dataUrl: string): boolean => {
  const raw = decodeQrDataUrl(dataUrl);
  if (!raw) return false;
  qrcode.generate(raw, { small: true });
  return true;
};

const presentQr = (
  dataUrl: string,
  sessionId: string,
  baseUrl: string,
  apiKey: string,
): void => {
  const rendered = renderQrInTerminal(dataUrl);
  if (!rendered) {
    console.warn(
      '   (Could not decode QR image — use the saved PNG or curl command below)',
    );
  }
  const savedPath = saveQrImage(dataUrl);
  if (savedPath) {
    console.warn(`\n   QR also saved to: ${savedPath}`);
    console.warn(`   Open it with:    open ${savedPath}`);
  }
  console.warn('\n   To re-fetch the QR if it expires:');
  console.warn(
    `     curl -s -H "X-API-Key: ${apiKey}" ${baseUrl}/api/sessions/${sessionId}/qr \\`,
  );
  console.warn(
    `       | sed 's/.*"qrCode":"data:image\\/png;base64,//;s/".*//' \\`,
  );
  console.warn(`       | base64 -d > waify-qr.png`);
};

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
`;

const finalizeSetup = (sessionId: string): void => {
  saveConfig({ ...loadConfig(), openwaSessionId: sessionId });
  if (!existsSync(promptPath())) {
    savePrompt(defaultPrompt);
  }
  if (!existsSync(scheduleJsonPath())) {
    saveSchedule({ jobs: [{ name: 'waify-morning', schedule: '0 0 9 * * *', command: 'send' }, { name: 'waify-evening', schedule: '0 0 19 * * *', command: 'send' }] });
  }
  console.warn('\n✓ All done! Run `waify send` to send your first message.');
};

const promptLine = (
  rl: ReturnType<typeof createInterface>,
  question: string,
): Promise<string> => new Promise((resolve) => rl.question(question, resolve));

const promptUntilValid = async (
  promptFn: (question: string) => Promise<string>,
  question: string,
  validate: (value: string) => boolean,
  errorMsg: string,
): Promise<string> => {
  const answer = (await promptFn(question)).trim()
  if (validate(answer)) return answer
  process.stderr.write(errorMsg + '\n')
  return promptUntilValid(promptFn, question, validate, errorMsg)
}

const collectJobs = async (
  promptFn: (question: string) => Promise<string>,
  accumulated: ScheduledJob[] = [],
): Promise<ScheduledJob[]> => {
  const name = await promptUntilValid(
    promptFn,
    'Job name: ',
    (v) => /^[a-z0-9-]+$/.test(v),
    'Name must be lowercase letters, numbers, and dashes only.',
  )
  const schedule = await promptUntilValid(
    promptFn,
    'Cron pattern (e.g. 0 0 9 * * *): ',
    isValidCron,
    'Invalid cron pattern. Use 6 space-separated fields, e.g. 0 0 9 * * *',
  )
  const job = ScheduledJobSchema.parse({ name, schedule, command: 'send' })
  const jobs = [...accumulated, job]
  const more = (await promptFn('Add another schedule? (y/N) ')).trim().toLowerCase()
  return more === 'y' ? collectJobs(promptFn, jobs) : jobs
}

export const promptScheduleJobs = async (
  promptFn: (question: string) => Promise<string>,
): Promise<ScheduledJob[]> => {
  process.stderr.write(
    '\nConfigure your message schedule (at least one job required).\n' +
      'Job names: lowercase letters, numbers, and dashes only.\n' +
      'Cron pattern: 6 fields, e.g. 0 0 9 * * *  (sec min hour dom month dow)\n\n',
  )
  return collectJobs(promptFn)
}

export const registerSetup = (program: Command): void => {
  program
    .command('setup')
    .description(
      'Guided first-run wizard: installs OpenWA, authenticates WhatsApp, and configures waify',
    )
    .action(async () => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        // Step 1 — Check Docker
        console.warn('Checking Docker...');
        const dockerCheck = spawnSync('docker', ['info'], { stdio: 'pipe' });
        if (dockerCheck.status !== 0) {
          console.error(
            'Docker is not running or not installed. Please install Docker and start it before running setup.',
          );
          process.exitCode = 1;
          return;
        }

        // Step 2 — Create config directory
        console.warn('Creating config directory...');
        mkdirSync(join(homedir(), '.config', 'waify'), { recursive: true });

        const baseUrl = loadConfig().openwaBaseUrl;

        // Step 3 — Prompt for Gemini API key
        let geminiKey = '';
        while (!geminiKey.trim()) {
          geminiKey = await promptLine(
            rl,
            'Enter your Gemini API key (get one free at https://aistudio.google.com/apikey):\n> ',
          );
          if (!geminiKey.trim()) {
            console.warn('Gemini API key cannot be empty. Please try again.');
          }
        }

        // Step 4 — Prompt for recipient phone number
        let recipientNumber = '';
        const phoneRegex = /^\d{8,15}$/;
        while (!phoneRegex.test(recipientNumber.trim())) {
          recipientNumber = await promptLine(
            rl,
            "Enter your recipient's WhatsApp number (e.g. 5511999998888 — digits only, no + or spaces):\n> ",
          );
          if (!phoneRegex.test(recipientNumber.trim())) {
            console.warn(
              'Invalid number format. Use digits only, 8–15 characters. Please try again.',
            );
          }
        }
        const chatId = `${recipientNumber.trim()}@c.us`;

        // Save Gemini key and recipient immediately so a QR timeout doesn't lose user input
        saveSecrets({ GEMINI_API_KEY: geminiKey.trim(), OPENWA_API_KEY: '' });
        saveConfig({ ...loadConfig(), recipients: [{ chatId }] });

        // Step 5 — Write docker-compose.yml
        console.warn('Writing docker-compose.yml...');
        writeFileSync(composePath(), composeTemplate(), 'utf-8');

        // Step 6 — Start API container
        console.warn(
          'Starting OpenWA containers (this may take a minute on first run)...',
        );
        const upResult = spawnSync(
          'docker',
          [
            'compose',
            '-f',
            composePath(),
            'up',
            '-d',
            '--no-deps',
            'openwa-api',
          ],
          {
            stdio: 'inherit',
          },
        );
        if (upResult.status !== 0) {
          console.error(
            'Failed to start OpenWA containers. Check docker compose logs for details.',
          );
          process.exitCode = 1;
          return;
        }

        // Step 7 — Wait for OpenWA API health check
        const apiSpinner = createSpinner('Waiting for OpenWA API to start...');
        let apiReady = false;
        for (let attempt = 0; attempt < 30; attempt++) {
          try {
            const res = await fetchWithTimeout(`${baseUrl}/api/health`);
            if (res.status >= 200 && res.status < 300) {
              apiReady = true;
              break;
            }
          } catch {
            // not ready yet
          }
          await wait(2000);
        }
        if (!apiReady) {
          apiSpinner.fail(
            `OpenWA API did not become ready in time. Check logs with: docker compose -f ${composePath()} logs openwa-api`,
          );
          process.exitCode = 1;
          return;
        }
        apiSpinner.succeed('OpenWA API is ready');

        // Step 8 — Read the API key the server generated (production mode generates a random key)
        console.warn('Reading API key from container...');
        const keyResult = spawnSync(
          'docker',
          [
            'compose',
            '-f',
            composePath(),
            'exec',
            '-T',
            'openwa-api',
            'cat',
            '/app/data/.api-key',
          ],
          { encoding: 'utf-8' },
        );
        const openwaApiKey = keyResult.stdout?.trim();
        if (keyResult.status !== 0 || !openwaApiKey) {
          const errorMsg =
            keyResult.stderr?.trim() ||
            'Could not read API key from container.';
          throw new Error(
            `${errorMsg} Check logs with: docker compose -f ${composePath()} logs openwa-api`,
          );
        }
        saveSecrets({
          GEMINI_API_KEY: geminiKey.trim(),
          OPENWA_API_KEY: openwaApiKey,
        });
        saveConfig({ ...loadConfig(), openwaApiKey, recipients: [{ chatId }] });

        // Step 9 — Create or retrieve existing WhatsApp session
        console.warn('Creating WhatsApp session...');
        const sessionRes = await fetchWithTimeout(
          `${baseUrl}/api/sessions`,
          {
            method: 'POST',
            headers: {
              'X-API-Key': openwaApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: SESSION_NAME }),
          },
          10000,
        );

        let sessionId: string;
        if (sessionRes.status === 409) {
          // Session already exists from a previous run — look it up by name
          const listRes = await fetchWithTimeout(
            `${baseUrl}/api/sessions`,
            {
              headers: { 'X-API-Key': openwaApiKey },
            },
            10000,
          );
          if (!listRes.ok) {
            throw new Error(
              `Failed to list sessions: ${listRes.status} ${listRes.statusText}`,
            );
          }
          const sessions = SessionListSchema.parse(await listRes.json());
          const existing = sessions.find((s) => s.name === SESSION_NAME);
          if (!existing?.id) {
            throw new Error(
              'Session "waify" already exists but could not be retrieved',
            );
          }
          sessionId = existing.id;
        } else if (!sessionRes.ok) {
          throw new Error(
            `Failed to create session: ${sessionRes.status} ${sessionRes.statusText}`,
          );
        } else {
          const sessionData = SessionResponseSchema.parse(
            await sessionRes.json(),
          );
          sessionId = sessionData.id ?? sessionData.name ?? SESSION_NAME;
        }

        // Step 10 — Clear stale Chromium lock files left by a previous crashed run
        spawnSync(
          'docker',
          [
            'compose',
            '-f',
            composePath(),
            'exec',
            '-T',
            'openwa-api',
            'sh',
            '-c',
            `rm -f /app/data/sessions/session-${SESSION_NAME}/Singleton*`,
          ],
          { encoding: 'utf-8' },
        );

        // Step 11 — Start session to initiate WhatsApp engine (400 = already started, that's ok)
        // Timeout is generous (60s) because Chromium cold-start can be slow; a TimeoutError
        // here means the engine is still loading — fall through to the QR poll loop instead
        // of hard-failing, since the QR loop waits up to 5 min anyway.
        console.warn('Starting WhatsApp engine...');
        try {
          const startRes = await fetchWithTimeout(
            `${baseUrl}/api/sessions/${sessionId}/start`,
            {
              method: 'POST',
              headers: { 'X-API-Key': openwaApiKey },
            },
            60000,
          );
          if (!startRes.ok && startRes.status !== 400) {
            throw new Error(
              `Failed to start session: ${startRes.status} ${startRes.statusText}`,
            );
          }
        } catch (err) {
          if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
            console.warn(
              '   (Engine start is taking longer than expected — Chromium may still be loading, continuing…)',
            );
          } else {
            throw err;
          }
        }

        // Pre-check — if the session is already linked from a previous run,
        // skip the QR poll (which would otherwise wait the full 5 min timeout
        // because OpenWA doesn't generate a QR for ready sessions).
        try {
          const preStatusRes = await fetchWithTimeout(
            `${baseUrl}/api/sessions/${sessionId}`,
            { headers: { 'X-API-Key': openwaApiKey } },
          );
          if (preStatusRes.ok) {
            const preStatus = StatusResponseSchema.safeParse(
              await preStatusRes.json(),
            );
            if (preStatus.success && preStatus.data.status === 'ready') {
              console.warn('✓ WhatsApp already linked — skipping QR scan');
              finalizeSetup(sessionId);
              return;
            }
          }
        } catch {
          // Status read failed — fall through to QR polling. No regression.
        }

        // Step 12 — Wait for QR code to be ready (Chromium cold-start can take several minutes)
        const qrSpinner = createSpinner('Waiting for QR code (Chromium is starting)...');
        let qrCode: string | undefined;
        const qrStart = Date.now();
        for (let attempt = 0; attempt < 150; attempt++) {
          const elapsed = Math.round((Date.now() - qrStart) / 1000);
          qrSpinner.update(`Waiting for QR code... (${elapsed}s / 5 min)`);
          try {
            const qrRes = await fetchWithTimeout(
              `${baseUrl}/api/sessions/${sessionId}/qr`,
              {
                headers: { 'X-API-Key': openwaApiKey },
              },
            );
            if (qrRes.ok) {
              const qrData = QrResponseSchema.parse(await qrRes.json());
              if (qrData.qrCode) {
                qrCode = qrData.qrCode;
                break;
              }
            }
          } catch {
            // not ready yet
          }
          await wait(2000);
        }
        qrSpinner.stop();

        console.warn(
          '\n📱 Scan the QR code below with WhatsApp to link your device:',
        );
        console.warn('   Settings → Linked Devices → Link a Device\n');
        if (qrCode) {
          presentQr(qrCode, sessionId, baseUrl, openwaApiKey);
          console.warn(
            '\n   (QR expires in ~20s — re-run setup if it expires before you scan)',
          );
        } else {
          console.warn(
            '   QR code was not ready in time. Re-run `waify setup` to try again.',
          );
        }

        // Step 13 — Poll for WhatsApp connection
        const connectSpinner = createSpinner(
          'Waiting for you to scan the QR code...',
        );
        let connected = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          try {
            const statusRes = await fetchWithTimeout(
              `${baseUrl}/api/sessions/${sessionId}`,
              {
                headers: { 'X-API-Key': openwaApiKey },
              },
            );
            const parsed = StatusResponseSchema.safeParse(
              await statusRes.json(),
            );
            if (!parsed.success) continue;
            if (parsed.data.status === 'ready') {
              connected = true;
              break;
            }
          } catch {
            // keep polling
          }
          await wait(2000);
        }
        if (!connected) {
          connectSpinner.fail(
            'WhatsApp did not connect within 2 minutes. Please re-run `waify setup` to try again.',
          );
          process.exitCode = 1;
          return;
        }
        connectSpinner.succeed('WhatsApp connected!');

        // Steps 14–16 — Persist session ID, seed defaults, done
        finalizeSetup(sessionId);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      } finally {
        rl.close();
      }
    });
};
