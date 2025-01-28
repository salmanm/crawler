import { spawn } from 'child_process'
import { openSync } from 'fs'
import path from 'path'
import { cwd } from 'process'
import prompts from 'prompts'

async function fn() {
  const answers = await prompts([
    {
      type: 'confirm',
      name: 'runInBg',
      message: 'Run in background?',
      initial: true,
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Confirm?',
      initial: false,
    },
  ])

  if (answers.confirm !== true) {
    process.exit()
  }

  console.log('Starting Crawler...')

  const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 16).split('T').join('-')

  const stdoutLog = path.join(cwd(), 'results', `${timestamp}-out.log`)
  const stderrLog = path.join(cwd(), 'results', `${timestamp}-err.log`)
  const consoleOut = path.join(cwd(), 'results', `${timestamp}-console.log`)

  const cmd = 'tsx'
  const args = ['src/main']

  const child = spawn(cmd, args, {
    stdio: answers.runInBg ? ['inherit', openSync(stdoutLog, 'a'), openSync(stderrLog, 'a')] : 'inherit',
    env: { ...process.env },
    detached: answers.runInBg,
  })

  console.log(`Spawned process PID: ${child.pid}`)
  console.log('Console:', consoleOut)
  console.log('Stdout:', stdoutLog)
  console.log('Stderr:', stderrLog)

  if (answers.runInBg) {
    child.unref()
    process.exit(0)
  }
}

fn()
