import type { Command } from 'commander'
import { spawnSync } from 'child_process'
import { promptPath } from '../../core/paths.ts'
import { PromptSchema, loadPrompt, savePrompt } from '../../core/prompt.ts'
import { existsSync } from 'fs'

export const registerPrompt = (program: Command): void => {
  const prompt = program.command('prompt').description('View or edit the system prompt and examples')

  prompt
    .command('show')
    .description('Print the current prompt and examples')
    .action(() => {
      const p = loadPrompt()
      console.warn('# system prompt')
      process.stdout.write(p.systemPrompt + '\n')
      console.warn('\n# examples')
      p.examples.forEach((e, i) => process.stdout.write(`${i + 1}. ${e}\n`))
    })

  prompt
    .command('edit')
    .description('Open prompt.json in $EDITOR')
    .action(() => {
      const editor = process.env['EDITOR'] ?? process.env['VISUAL'] ?? 'vi'
      const path = promptPath()
      if (!existsSync(path)) {
        savePrompt(loadPrompt())
      }
      const result = spawnSync(editor, [path], { stdio: 'inherit' })
      if (result.status !== 0) {
        throw new Error(`Editor exited with status ${result.status}`)
      }
      const reloaded = loadPrompt()
      PromptSchema.parse(reloaded)
      console.warn('prompt updated and re-validated')
    })

  prompt
    .command('add-example <text>')
    .description('Append a new few-shot example')
    .action((text: string) => {
      const current = loadPrompt()
      savePrompt({ ...current, examples: [...current.examples, text] })
      console.warn(`added example #${current.examples.length + 1}`)
    })

  prompt
    .command('remove-example <index>')
    .description('Remove the Nth example (1-indexed)')
    .action((index: string) => {
      const current = loadPrompt()
      const i = parseInt(index, 10) - 1
      if (Number.isNaN(i) || i < 0 || i >= current.examples.length) {
        throw new Error(`Index out of range. Have ${current.examples.length} examples.`)
      }
      const next = current.examples.filter((_, idx) => idx !== i)
      savePrompt({ ...current, examples: next })
      console.warn(`removed example #${i + 1}`)
    })
}
