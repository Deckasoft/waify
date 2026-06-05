import { mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { composePath, schedulePath } from './paths.ts'

// The scheduler's TZ env makes Ofelia evaluate cron in the user's timezone
// (the image ships tzdata). openwa-api and the scheduler share waify-network,
// which is named explicitly so it matches the `network =` line in ofelia.ini.
export const composeTemplate = (timezone: string): string => `services:
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
    networks:
      - waify-network
    restart: unless-stopped

  scheduler:
    image: mcuadros/ofelia:latest
    depends_on:
      - openwa-api
    command: daemon --config=/etc/ofelia/config.ini
    environment:
      - TZ=${timezone}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ${schedulePath()}:/etc/ofelia/config.ini:ro
    networks:
      - waify-network
    restart: unless-stopped

volumes:
  openwa-data:

networks:
  waify-network:
    name: waify-network
`

export const writeCompose = (timezone: string): void => {
  const path = composePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, composeTemplate(timezone), 'utf-8')
}
