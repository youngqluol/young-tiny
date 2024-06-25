#!/usr/bin/env node

import path from 'node:path'
import https from 'node:https'
import process from 'node:process'
import fsPromises from 'node:fs/promises'
import fs from 'node:fs'
import minimist from 'minimist'
import md5 from 'md5'
import { error, header, success, transformSize, warn } from './utils'
import { config, filesExclude, imgsInclude } from './constant'
import type { UploadResponseData } from './types'

const args = minimist(process.argv.slice(2))

/**
 * args参数
 * @param {*} md
 * 默认不生成md文件
 * 如果需要生成md文件，传入参数md
 * node index.js --md=true
 * @returns 是否生成md文件
 *
 * @param {*} folder
 * 图片压缩文件范围，默认src文件夹
 * node index.js --folder=src
 * @returns
 */

// 历史文件压缩后生成的md5
const keys: string[] = []

// 读取指定文件夹下所有文件
let filesList: any[] = []

// 压缩后文件列表
const squashList: any[] = []

// 读取文件
async function read(dir) {
  const res = await fsPromises.readFile(dir, 'utf-8')
  const { list } = JSON.parse(res)
  success('文件指纹读取成功')
  return list
}

// 上传文件
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

// 下载文件
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

// 递归遍历指定类型文件
function readFile(filePath: string, filesList: any[]) {
  const files = fs.readdirSync(filePath)
  files.forEach((file) => {
    const fPath = path.join(filePath, file)
    const states = fs.statSync(fPath)
    const extname = path.extname(file)
    if (states.isFile()) {
      const obj = {
        size: states.size,
        name: file,
        path: fPath,
      }
      const key = md5(fPath + states.size)
      if (states.size > config.max)
        warn(`文件${file}超出5M的压缩限制`)
      if (states.size < config.max && imgsInclude.includes(extname) && !keys.includes(key))
        filesList.push(obj)
    }
    else {
      if (!filesExclude.includes(file))
        readFile(fPath, filesList)
    }
  })
}

function getFileList(filePath) {
  const filesList = []
  readFile(filePath, filesList)
  return filesList
}

function writeFile(fileName, data) {
  fs.writeFile(fileName, data, 'utf-8', () => {
    success('文件生成成功')
  })
}

let str = `# 项目原始图片对比\n
## 图片压缩信息\n
| 文件名 | 文件体积 | 压缩后体积 | 压缩比 | 文件路径 |\n| -- | -- | -- | -- | -- |\n`

function output(list) {
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
  writeFile('图片压缩比.md', str)
}

// 生成文件指纹
function fingerprint() {
  const list: any[] = []
  squashList.forEach((item) => {
    const { miniSize, path } = item
    const md5s = md5(path + miniSize)
    list.push(md5s)
  })
  fs.writeFile('squash.json', JSON.stringify({ list: keys.concat(list) }, null, '\t'), (err) => {
    if (err)
      throw err
    success('文件指纹生成成功')
  })
}

function squash() {
  try {
    Promise.all(
      filesList.map(async (item) => {
        success(item.path)
        const fpath = fs.readFileSync(item.path, 'binary')
        const { output = null } = await upload(fpath)
        if (!output?.url)
          return
        const data = await download(output.url)
        if (!data)
          return
        fs.writeFileSync(item.path, data, 'binary')
        return new Promise<void>((resolve) => {
          const miniSize = fs.statSync(item.path).size
          squashList.push({ ...item, miniSize })
          resolve()
        })
      }),
    ).then(() => {
      if (args.md)
        output(squashList)
      fingerprint()
      console.timeEnd('squash time')
    }).catch((err) => {
      error(err)
    })
  }
  catch (error) {
    return Promise.reject(error)
  }
}

async function start() {
  try {
    const files = args.folder || 'src'
    const isDirExist = fs.existsSync(files)
    if (!isDirExist) {
      error('当前目录不存在，请更换压缩目录')
      return
    }
    const isJsonExist = fs.existsSync('squash.json')
    if (isJsonExist)
      await read('squash.json')
    filesList = getFileList(files)
    squash()
  }
  catch (err) {
    process.exit(1)
    error(err)
  }
}

console.time('squash time')
start()
