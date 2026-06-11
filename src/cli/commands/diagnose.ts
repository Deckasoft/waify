import type { Command } from 'commander'
import { runDiagnostics, type CheckResult, type CheckStatus } from '../../core/diagnose.ts'

const ICONS: Record<CheckStatus, string> = {
  ok: '✓',
  warn: '⚠',
  error: '✗',
  fixed: '◎',
}

const LABELS: Record<CheckStatus, string> = {
  ok: 'ok   ',
  warn: 'warn ',
  error: 'error',
  fixed: 'fixed',
}

const formatResult = (r: CheckResult): string => {
  const icon = ICONS[r.status]
  const label = LABELS[r.status]
  const name = r.name.padEnd(16)
  const line = `  ${icon} ${label}  ${name}  ${r.message}`
  return r.detail ? `${line}\n         ${r.detail.split('\n').join('\n         ')}` : line
}

export const registerDiagnose = (program: Command): void => {
  program
    .command('diagnose')
    .description('Check why scheduled messages are not firing and optionally auto-fix issues')
    .option('-f, --fix', 'automatically fix recoverable issues (restart containers, regenerate ofelia.ini)')
    .action(async (opts: { fix?: boolean }) => {
      const fix = opts.fix ?? false
      if (fix) {
        console.warn('Running diagnostics with auto-fix enabled…\n')
      } else {
        console.warn('Running diagnostics (read-only — pass --fix to auto-fix recoverable issues)…\n')
      }

      const results = await runDiagnostics(fix)

      for (const r of results) {
        console.warn(formatResult(r))
      }

      const errors = results.filter((r) => r.status === 'error')
      const fixed = results.filter((r) => r.status === 'fixed')
      const warns = results.filter((r) => r.status === 'warn')

      console.warn('')
      if (errors.length === 0) {
        const fixedNote = fixed.length > 0 ? ` (${fixed.length} issue(s) auto-fixed)` : ''
        const warnNote = warns.length > 0 ? ` — ${warns.length} warning(s) above` : ''
        console.warn(`  All checks passed${fixedNote}${warnNote}.`)
        console.warn('  Scheduled messages should fire correctly.')
      } else {
        console.warn(`  ${errors.length} check(s) failed. Remaining actions required:`)
        for (const r of errors) {
          console.warn(`    • [${r.name}] ${r.message}`)
        }
        if (!fix) {
          console.warn('\n  Tip: run `waify diagnose --fix` to auto-fix recoverable issues.')
        }
        process.exitCode = 1
      }
    })
}
