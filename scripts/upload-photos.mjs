// Выгружает обработанные фото и видео в бакет R2: photos-out/<путь> → <путь>. Отдаёт их воркер worker/.
// Запуск: npm run upload, а также в конце npm run photos (ключи — в .env). Файл выгружается, если его нет в бакете или MD5 не совпадает с ETag.
// Лишние объекты в бакете не удаляются — только перечисляются.
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { AwsClient } from 'aws4fetch'

const root = path.resolve(import.meta.dirname, '..')
const localRoot = path.join(root, 'photos-out')
const TYPES = { '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4' }
const PARALLEL = 8

const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID, R2_BUCKET } = process.env
if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ACCOUNT_ID || !R2_BUCKET) {
  console.error('Нет доступа к R2: заполните .env (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID, R2_BUCKET)')
  process.exit(1)
}
// aws4fetch сам повторяет запрос при 5xx и 429.
const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' })
const bucketUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`
const objectUrl = (key) => `${bucketUrl}/${key.split('/').map(encodeURIComponent).join('/')}`

const remote = await listRemote()
const local = (await readdir(localRoot, { recursive: true, withFileTypes: true }))
  .filter((e) => e.isFile() && TYPES[path.extname(e.name).toLowerCase()])
  .map((e) => path.relative(localRoot, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
  .sort()

let uploaded = 0
let uploadedBytes = 0
let skipped = 0
const failed = []
let next = 0
await Promise.all(Array.from({ length: PARALLEL }, worker))

const extra = [...remote.keys()].filter((k) => !local.includes(k))
console.log(`${process.stdout.isTTY ? '\n' : ''}Выгружено: ${uploaded} (${(uploadedBytes / 1048576).toFixed(0)} МБ), без изменений: ${skipped}`)
if (extra.length) console.log(`В бакете есть файлы, которых нет локально (не удалены): ${extra.length}`)
if (failed.length) {
  console.error(`Ошибки: ${failed.length}\n${failed.join('\n')}`)
  process.exit(1)
}

async function worker() {
  while (next < local.length) {
    const key = local[next++]
    try {
      const body = await readFile(path.join(localRoot, key))
      // У объекта, выгруженного одним запросом, ETag — MD5 содержимого.
      const md5 = createHash('md5').update(body).digest('hex')
      if (remote.get(key) === md5) {
        skipped++
      } else {
        const type = TYPES[path.extname(key).toLowerCase()]
        const res = await r2.fetch(objectUrl(key), { method: 'PUT', body, headers: { 'Content-Type': type } })
        if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
        uploaded++
        uploadedBytes += body.length
      }
    } catch (error) {
      failed.push(`${key}: ${error.message}`)
    }
    const done = uploaded + skipped + failed.length
    if (process.stdout.isTTY) process.stdout.write(`\r${done}/${local.length}`)
    else if (done % 250 === 0) console.log(`${done}/${local.length}`)
  }
}

// Ключ → MD5 из ETag для всех объектов бакета (ListObjectsV2 отдаёт до 1000 за запрос).
async function listRemote() {
  const result = new Map()
  let token
  do {
    const url = `${bucketUrl}?list-type=2${token ? `&continuation-token=${encodeURIComponent(token)}` : ''}`
    const res = await r2.fetch(url)
    if (!res.ok) throw new Error(`Список объектов R2: ${res.status} ${await res.text()}`)
    const xml = await res.text()
    for (const [, item] of xml.matchAll(/<Contents>(.*?)<\/Contents>/gs)) {
      const key = unescapeXml(item.match(/<Key>(.*?)<\/Key>/s)[1])
      const etag = unescapeXml(item.match(/<ETag>(.*?)<\/ETag>/s)?.[1] ?? '').replaceAll('"', '')
      result.set(key, etag)
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unescapeXml(xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/s)[1]) : undefined
  } while (token)
  return result
}

function unescapeXml(s) {
  return s.replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')
}
