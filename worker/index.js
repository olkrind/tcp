// GET /<альбом>/<файл> → объект бакета. Лимит бесплатного плана — 100 000 запросов в сутки на все альбомы,
// поэтому файлы кэшируются в браузере надолго: повторный просмотр альбома лимит не тратит.
const CACHE = 'public, max-age=2592000' // 30 дней: заменённый файл с тем же именем обновится у посетителей не сразу

export default {
  async fetch(request, env) {
    const cors = { 'Access-Control-Allow-Origin': '*' } // «Download all» собирает zip из файлов через fetch
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, HEAD' } })
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: cors })

    const key = decodeURIComponent(new URL(request.url).pathname.slice(1))
    // range — перемотка видео; Safari без ответа 206 видео не воспроизводит. onlyIf — ответ 304 по If-None-Match.
    const object = await env.PHOTOS.get(key, { range: request.headers, onlyIf: request.headers })
    if (!object) return new Response('Not found', { status: 404, headers: cors })

    const headers = new Headers(cors)
    object.writeHttpMetadata(headers)
    headers.set('ETag', object.httpEtag)
    headers.set('Cache-Control', CACHE)
    headers.set('Accept-Ranges', 'bytes')
    if (!('body' in object)) return new Response(null, { status: 304, headers })

    const range = rangeOf(object, request)
    if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${object.size}`)
    return new Response(request.method === 'HEAD' ? null : object.body, { status: range ? 206 : 200, headers })
  },
}

function rangeOf(object, request) {
  if (!request.headers.has('Range') || !object.range) return null
  // Поля диапазона в R2 есть всегда, неиспользуемые — undefined: проверка по значению, не по наличию ключа.
  const { offset, length, suffix } = object.range
  const start = suffix !== undefined ? object.size - suffix : (offset ?? 0)
  const end = length !== undefined ? start + length - 1 : object.size - 1
  return { start, end }
}
