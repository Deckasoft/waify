import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'

const PackageJsonSchema = z.object({ version: z.string() })

// Walks up from this module to the nearest package.json with a version.
// Works in dev (src/) and bundled (dist/cli/) layouts, so the CLI version
// always tracks the published package version instead of a hardcoded string.
export const readWaifyVersion = (): string => {
  const climb = (dir: string): string => {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      try {
        return PackageJsonSchema.parse(JSON.parse(readFileSync(candidate, 'utf-8'))).version
      } catch {
        /* keep climbing */
      }
    }
    const parent = dirname(dir)
    return parent === dir ? 'latest' : climb(parent)
  }
  return climb(dirname(fileURLToPath(import.meta.url)))
}
