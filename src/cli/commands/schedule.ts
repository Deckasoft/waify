import type { Command } from 'commander'
import { ScheduledJobSchema, addJob, loadSchedule, removeJob } from '../../core/schedule.ts'
import { composePath } from '../../core/paths.ts'
import { restartScheduler as restartSchedulerService } from '../../core/scheduler.ts'

const restartScheduler = async (): Promise<void> => {
  console.warn('restarting scheduler…')
  const result = await restartSchedulerService()
  if (!result.ok) {
    console.warn(
      `warning: scheduler restart failed — run manually: docker compose -f ${composePath()} up -d --force-recreate scheduler`,
    )
  }
}

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
    .description('Add a new job. <cron> uses 6-field syntax (sec min hour dom month dow), e.g. "0 0 9 * * *"')
    .option('-c, --command <cmd>', 'command for the sender container to run', 'send')
    .option('--no-restart', 'skip automatic scheduler restart')
    .action(async (name: string, cron: string, { command, restart }: { command: string; restart: boolean }) => {
      const job = ScheduledJobSchema.parse({ name, schedule: cron, command })
      addJob(job)
      console.warn(`added job "${name}"`)
      if (restart) await restartScheduler()
    })

  schedule
    .command('remove <name>')
    .description('Remove a job by name')
    .option('--no-restart', 'skip automatic scheduler restart')
    .action(async (name: string, { restart }: { restart: boolean }) => {
      removeJob(name)
      console.warn(`removed job "${name}"`)
      if (restart) await restartScheduler()
    })
}
