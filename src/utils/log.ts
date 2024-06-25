import chalk from 'chalk'

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
