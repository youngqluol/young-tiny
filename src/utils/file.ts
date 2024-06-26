import fs from 'node:fs'

export function transformSize(size) {
  return size > 1024 ? `${(size / 1024).toFixed(2)}KB` : `${size}B`
}

export function exists(path) {
  return fs.existsSync(path)
}

export function isDir(path) {
  return exists(path) && fs.statSync(path).isDirectory()
}
