import chalk from 'chalk'
import ora from 'ora'
import type { Ora } from 'ora'

export const { log } = console

export function success(...args: any[]) {
  log(chalk.green(...args))
}

export function warn(...args: any[]) {
  log(chalk.yellow(...args))
}

export function error(...args: any[]) {
  log(chalk.red(...args))
}

export function info(...args: any[]) {
  log(chalk.blue(...args))
}

let spinner: Ora | null = null

export function startSpinner(text: string) {
  spinner = ora(text)
  spinner.start()
}

export function stopSpinner() {
  spinner?.stop()
}
