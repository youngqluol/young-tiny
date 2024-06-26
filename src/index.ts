#!/usr/bin/env node

import path from 'node:path'
import https from 'node:https'
import process from 'node:process'
import fsPromises from 'node:fs/promises'
import fs from 'node:fs'
import minimist from 'minimist'
import md5 from 'md5'
import chalk from 'chalk'
import { error, header, isDir, log, startSpinner, stopSpinner, success, transformSize, warn } from './utils'
import { config, filesExclude, imgsInclude } from './constant'
import type { UploadResponseData } from './types'

const args = minimist(process.argv.slice(2))

//  avoid duplicate compress
let md5Keys: string[] = []

// files waiting to upload
let filesList: any[] = []

// files info after compressing
const compressList: any[] = []

// read fingerprint
async function read(dir) {
  const res = await fsPromises.readFile(dir, 'utf-8')
  const { list } = JSON.parse(res)
  success('\u2714 read file md5 successfully')
  md5Keys = md5Keys.concat(...list)
  return list
}

//  upload file
function upload(file): Promise<UploadResponseData> {
  const options = header()
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => res.on('data', (data) => {
      let obj
      try {
        obj = JSON.parse(data.toString())
        obj.error ? reject(obj.message) : resolve(obj)
      }
      catch (err) {
        error(err)
        resolve({})
      }
    }))
    req.on('error', (err) => {
      error('upload Error:', err)
      reject(err)
    })
    req.write(file, 'binary')
    req.end()
  })
}

// download file
function download(url: string): Promise<any> {
  const options = new URL(url)
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let file = ''
      res.setEncoding('binary')
      res.on('data', (chunk) => {
        file += chunk
      })
      res.on('end', () => resolve(file))
    })
    req.on('error', (err) => {
      error('download fail:', url)
      reject(err)
    })
    req.end()
  })
}

// read files in target dir
function readFile(dir: string, filesList: any[], inputFiles: string[] = []) {
  const files = inputFiles.length ? inputFiles : fs.readdirSync(dir)
  files.forEach((file) => {
    const extname = path.extname(file)
    if (!imgsInclude.includes(extname))
      return
    const fPath = path.join(dir, file)
    const states = fs.statSync(fPath)
    if (states.isFile()) {
      const obj = {
        size: states.size,
        name: file,
        path: fPath,
      }
      const key = md5(fPath + states.size)
      if (states.size > config.max)
        warn(`文件${file}超出5M的压缩限制`)
      if (states.size < config.max && (args.repeat !== false || !md5Keys.includes(key)))
        filesList.push(obj)
    }
    else {
      if (!filesExclude.includes(file))
        readFile(fPath, filesList)
    }
  })
}

function getFileList(dir, inputFiles) {
  const filesList = []
  readFile(dir, filesList, inputFiles)
  return filesList
}

function writeFile(fileName, data) {
  fs.writeFile(fileName, data, 'utf-8', () => {
    success(`\u2714 ${fileName} 文件生成成功`)
  })
}

let str = `# 项目原始图片对比\n
## 图片压缩信息\n
| 文件名 | 文件体积 | 压缩后体积 | 压缩比 | 文件路径 |\n| -- | -- | -- | -- | -- |\n`

// 输出压缩信息.md
function output(list) {
  if (list.length === 0)
    return
  for (let i = 0; i < list.length; i++) {
    const { name, path: _path, size, miniSize } = list[i]
    const fileSize = `${transformSize(size)}`
    const compressionSize = `${transformSize(miniSize)}`
    const compressionRatio = `${`${(100 * (size - miniSize) / size).toFixed(2)}%`}`
    const desc = `| ${name} | ${fileSize} | ${compressionSize} | ${compressionRatio} | ${_path} |\n`
    str += desc
  }
  let size = 0
  let miniSize = 0
  list.forEach((item) => {
    size += item.size
    miniSize += item.miniSize
  })
  const s = `
## 体积变化信息\n
| 原始体积 | 压缩后提交 | 压缩比 |\n| -- | -- | -- |\n| ${transformSize(size)} | ${transformSize(miniSize)} | ${`${(100 * (size - miniSize) / size).toFixed(2)}%`} |
  `
  str = str + s
  writeFile('图片压缩信息.md', str)
}

// 生成文件指纹
function fingerprint() {
  const list: any[] = []
  compressList.forEach((item) => {
    const { miniSize, path } = item
    const md5s = md5(path + miniSize)
    list.push(md5s)
  })
  fs.writeFile('compress.json', JSON.stringify({ list: md5Keys.concat(list) }, null, '\t'), (err) => {
    if (err)
      throw err
    success('\u2714 文件指纹生成成功')
  })
}

async function squash() {
  const length = filesList.length
  await Promise.all(
    filesList.map(async (item, index) => {
      success(item.path)
      if (index === length - 1)
        success(`\u2714 Found ${length} image`)
      const fileData = fs.readFileSync(item.path, 'binary')
      const { output = null } = await upload(fileData)
      if (!output?.url) {
        error(`${item.path} upload fail`)
        return Promise.resolve()
      }
      const data = await download(output.url)
      if (!data) {
        error(`${item.path} download fail`)
        return Promise.resolve()
      }
      let newFilePath = item.path
      if (args.b) {
        const targetFolder = typeof args.b === 'string' ? args.b : '_compress'
        if (!fs.existsSync(targetFolder))
          fs.mkdirSync(targetFolder, { recursive: true })
        newFilePath = path.join(targetFolder, item.name)
      }
      fs.writeFileSync(newFilePath, data, 'binary')
      success(`\u2714 ${item.path} 压缩成功`)
      return new Promise<void>((resolve) => {
        const miniSize = fs.statSync(newFilePath).size
        compressList.push({ ...item, miniSize })
        resolve()
      })
    }),
  ).then(() => {
    if (args.md)
      output(compressList)
    if (args.repeat === false)
      fingerprint()
  }).catch((err) => {
    error(err)
  })
}

function consoleHelp() {
  const tips = `
    Usage
    tiny <file or path>
    tiny -b   // backup all your images into \`_compress\`
    tiny --b=dist  // backup all your images into \`dist\`
    tiny --md  // output compress info
    tiny --repeat=false  // not compress file repeatly

    Example

    tiny      // current dir
    tiny .    // current dir

    tiny a.jpg
    tiny a.jpg b.jpg
    tiny img/test.jpg

    tiny folder
    `
  console.log(chalk.green(tips))
}

export async function main() {
  if (args.h) {
    consoleHelp()
    return
  }
  let targetDir = './' // default path
  let inputFiles: string[] = []
  if (args._.length) { // user input
    if (args._.length === 1) { // "tiny ." || "tiny ./" || "tiny folder"
      if (args._[0] === '.' || args._[0] === './' || isDir(args._[0]))
        targetDir = args._[0] === '.' ? './' : args._[0]
      else
        inputFiles = args._
    }
    else {
      inputFiles = args._ // "tiny 1.png 2.png"
    }
  }
  const isDirExist = fs.existsSync(targetDir)
  if (!isDirExist) {
    error('\u2718 当前目录不存在，请更换压缩目录')
    return
  }
  console.time('compress time:')
  startSpinner('Processing...')
  if (args.repeat === false) {
    const isJsonExist = fs.existsSync('compress.json')
    if (isJsonExist)
      await read('compress.json')
  }
  filesList = getFileList(targetDir, inputFiles)
  if (filesList.length === 0)
    throw new Error('未找到需要压缩的图片')
  await squash()
  console.timeEnd('compress time:')
  stopSpinner()
}

main().catch((err) => {
  error(err)
  stopSpinner()
  process.exit(1)
})
