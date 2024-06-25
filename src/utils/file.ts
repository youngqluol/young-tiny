export function transformSize(size) {
  return size > 1024 ? `${(size / 1024).toFixed(2)}KB` : `${size}B`
}
