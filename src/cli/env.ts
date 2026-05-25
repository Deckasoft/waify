import { config as dotenvConfig } from 'dotenv'
import { envPath } from '../core/paths.ts'

dotenvConfig({ path: envPath() })
