import type { Command } from 'commander'
import { ScheduledJobSchema, addJob, loadSchedule, removeJob } from '../../core/schedule.ts'

export const registerSchedule = (program: Command): void => {
  const schedule = program.command('schedule').description('Manage Ofelia scheduled jobs')

  schedule
    .command('list')
    .description('List all scheduled jobs')
    .action(() => {
      const s = loadSchedule()
      if (s.jobs.length === 0) {
        console.warn('(no jobs)')
        return
      }
      s.jobs.forEach((j) => {
        process.stdout.write(`${j.name}\t${j.schedule}\t${j.command}\n`)
      })
    })

  schedule
    .command('add <name> <cron>')
    .description('Add a new job. <cron> uses 5-field crontab syntax, e.g. "0 9 * * *"')
    .option('-c, --command <cmd>', 'command for the sender container to run', 'send')
    .action((name: string, cron: string, { command }: { command: string }) => {
      const job = ScheduledJobSchema.parse({ name, schedule: cron, command })
      addJob(job)
      console.warn(`added job "${name}" — restart scheduler: docker compose restart scheduler`)
    })

  schedule
    .command('remove <name>')
    .description('Remove a job by name')
    .action((name: string) => {
      removeJob(name)
      console.warn(`removed job "${name}" — restart scheduler: docker compose restart scheduler`)
    })
}
