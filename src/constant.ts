// 需要处理的文件类型
export const imgsInclude = ['.png', '.jpg']

// 不进行处理的文件夹
export const filesExclude = ['dist', 'build', 'node_modules', 'config']

export const config = {
  // 图片最大限制5M
  max: 5242880,
  // 每次最多处理20张，默认处理10张
  maxLength: 10,
}
