export const urls = [
  'tinyjpg.com',
  'tinypng.com',
]

export const apiPath = '/backend/opt/shrink'

// 请求头
export function header() {
  const ip = Array.from({ length: 4 }).fill(0).map(() => Number.parseInt(`${Math.random() * 255}`)).join('.')
  const index = Math.round(Math.random())
  return {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Postman-Token': Date.now(),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'X-Forwarded-For': ip,
    },
    hostname: urls[index],
    method: 'POST',
    path: apiPath,
    rejectUnauthorized: false,
  }
}
