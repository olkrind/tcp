// Готовит фото для сайта: photos-src/<slug>/* (или photos-src/<slug>/<раздел>/*) → photos-out/… и src/generated/albums.json.
// Запуск: npm run photos — после обработки выгружает photos-out/ в R2 (scripts/upload-photos.mjs).
// Уже обработанные файлы пропускаются, если исходник не новее.
// Видео сжимается ffmpeg (должен быть в PATH) в MP4; заставка в сетке — первый кадр.
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'

const run = promisify(execFile)

const root = path.resolve(import.meta.dirname, '..')
const srcRoot = path.join(root, 'photos-src')
// Вне public/: в сборку сайта копии не попадают, их отдаёт воркер из R2.
const outRoot = path.join(root, 'photos-out')
const manifestPath = path.join(root, 'src', 'generated', 'albums.json')

// Размер — по длинной стороне. Последний — JPEG: его отдаёт кнопка «Скачать» и он же идёт в og:image.
// На 20 кадрах с плёночным зерном: ~28 + ~121 + ~291 КБ на фото.
const SIZES = [
  { long: 640, format: 'webp', options: { quality: 75 } },
  { long: 1600, format: 'webp', options: { quality: 75 } },
  { long: 2048, format: 'jpeg', options: { quality: 80, mozjpeg: true } },
]
const INPUT_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'])
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v'])
// H.264 CRF 23: на 22-секундном ролике 1080p 48 Мбит/с — 27 МБ вместо 138 МБ, VMAF 96.
// Лимит GitHub — 100 МБ на файл: ролик длиннее ~1,5 минуты при таком качестве в него не поместится.
const VIDEO_ARGS = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k']

// Имя файла для URL: кириллица транслитерируется, пробелы и прочие символы — в «-».
// Пробел в имени ломает srcset: браузер делит его значение по пробелам.
const TRANSLIT = Object.fromEntries(
  'а:a б:b в:v г:g д:d е:e ё:e ж:zh з:z и:i й:y к:k л:l м:m н:n о:o п:p р:r с:s т:t у:u ф:f х:h ц:ts ч:ch ш:sh щ:sch ъ: ы:y ь: э:e ю:yu я:ya'
    .split(' ')
    .map((p) => p.split(':')),
)
const urlSafe = (s) =>
  [...s]
    .map((c) => {
      const t = TRANSLIT[c.toLowerCase()]
      return t === undefined ? c : c === c.toLowerCase() ? t : t.charAt(0).toUpperCase() + t.slice(1)
    })
    .join('')
    .replace(/[^A-Za-z0-9_.-]+/g, '-')

const albums = JSON.parse(await readFile(path.join(root, 'content', 'albums.json'), 'utf8'))
const previous = await readJson(manifestPath, [])

const manifest = []
for (const album of albums) {
  const srcDir = path.join(srcRoot, album.slug)

  if (!(await stat(srcDir).catch(() => null))) {
    // Исходников нет (например, на другом компьютере) — берём прошлый результат.
    const old = previous.find((a) => a.slug === album.slug)
    if (old) manifest.push({ ...old, ...album, cover: old.cover })
    else console.warn(`⚠ ${album.slug}: нет ни photos-src/${album.slug}, ни данных в манифесте — альбом пропущен`)
    continue
  }

  // Альбом с разделами: фото раздела — в photos-src/<slug>/<section.dir>/, копии — в photos-out/<slug>/<section.slug>/.
  const parts = album.sections
    ? album.sections.map((s) => ({ section: s.slug, srcDir: path.join(srcDir, s.dir), urlDir: `${album.slug}/${s.slug}` }))
    : [{ section: undefined, srcDir, urlDir: album.slug }]

  const photos = []
  for (const part of parts) {
    const files = (await listImages(part.srcDir)) ?? []
    await mkdir(path.join(outRoot, part.urlDir), { recursive: true })
    for (const [i, file] of files.entries()) {
      const srcFile = path.join(part.srcDir, file)
      const photo = VIDEO_EXT.has(path.extname(file).toLowerCase())
        ? await processVideo(srcFile, part.urlDir)
        : await processPhoto(srcFile, part.urlDir)
      photos.push(part.section ? { ...photo, section: part.section } : photo)
      if (process.stdout.isTTY) process.stdout.write(`\r${part.urlDir}: ${i + 1}/${files.length}`)
    }
    console.log(`${process.stdout.isTTY ? '\r' : ''}${part.urlDir}: ${files.length} фото`)
  }

  // Обложка — фото альбома по имени или отдельный файл в photos-src/<slug>/, которого нет среди фото альбома.
  let cover = photos.find((p) => p.name === album.cover)
  let coverPhoto
  if (!cover && album.cover && (await stat(path.join(srcDir, album.cover)).catch(() => null))) {
    coverPhoto = await processPhoto(path.join(srcDir, album.cover), album.slug)
    cover = coverPhoto
  }
  cover ??= photos[0]
  manifest.push({ ...album, cover: cover?.name ?? null, ...(coverPhoto && { coverPhoto }), photos })
}

await mkdir(path.dirname(manifestPath), { recursive: true })
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Готово: ${manifest.length} альбом(ов), манифест — src/generated/albums.json`)

// Фото профиля для визитки: photos-src/avatar.jpg → квадрат 400 px (кружок на странице, файл контакта)
// и 1200 px (превью ссылки). Цветовой профиль переводится в sRGB, иначе оттенки Display P3 в браузерах расходятся.
const avatarSrc = path.join(srcRoot, 'avatar.jpg')
if (await stat(avatarSrc).catch(() => null)) {
  for (const size of [400, 1200]) {
    await sharp(avatarSrc)
      .rotate()
      .resize(size, size, { fit: 'cover' })
      .toColourspace('srgb')
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(path.join(root, 'public', `avatar-${size}.jpg`))
  }
  console.log('Фото профиля: public/avatar-400.jpg, public/avatar-1200.jpg')

  // Значок вкладки: квадрат со скруглением 22% стороны, как у иконок iOS. apple-touch-icon — квадрат без прозрачности:
  // iOS сам скругляет углы, а прозрачные пиксели заливает чёрным.
  const rounded = (n) =>
    Buffer.from(`<svg width="${n}" height="${n}"><rect width="${n}" height="${n}" rx="${n * 0.2237}"/></svg>`)
  for (const size of [32, 192]) {
    await sharp(avatarSrc)
      .rotate()
      .resize(size, size, { fit: 'cover' })
      .toColourspace('srgb')
      .composite([{ input: rounded(size), blend: 'dest-in' }])
      .png()
      .toFile(path.join(root, 'public', `favicon-${size}.png`))
  }
  // icon-192 и icon-512 — для manifest.webmanifest (сайт как приложение на экране «Домой»), тоже без прозрачности.
  for (const [size, file] of [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
    await sharp(avatarSrc)
      .rotate()
      .resize(size, size, { fit: 'cover' })
      .toColourspace('srgb')
      .png()
      .toFile(path.join(root, 'public', file))
  }
  console.log('Значки: public/favicon-32.png, favicon-192.png, apple-touch-icon.png, icon-192.png, icon-512.png')
}

// Видео → <имя>.mp4 и заставка из первого кадра в тех же размерах, что фото. В манифесте — запись фото с полем video.
async function processVideo(srcFile, urlDir) {
  const name = path.basename(srcFile)
  const outName = `${urlSafe(path.parse(name).name)}.mp4`
  const outFile = path.join(outRoot, urlDir, outName)
  const srcMtime = (await stat(srcFile)).mtimeMs

  const outStat = await stat(outFile).catch(() => null)
  if (!outStat || outStat.mtimeMs < srcMtime) {
    // HDR с iPhone (HLG) без перевода в BT.709 выходит в H.264 бледным. HLG совместим с SDR по кривой яркости,
    // поэтому переводится только цветовой охват BT.2020 → BT.709 (zscale для полного тонмаппинга в сборке ffmpeg нет).
    const { stdout: transfer } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=color_transfer', '-of', 'csv=p=0', srcFile])
    const hdr = transfer.trim().split('\n')[0]
    const filter = hdr === 'arib-std-b67' ? ['-vf', 'colorspace=all=bt709:iall=bt2020:itrc=bt709:format=yuv420p'] : []
    if (hdr === 'smpte2084') console.warn(`⚠ ${name}: HDR10 (PQ) — цвета без перевода в SDR будут искажены`)
    // Поворот из метаданных (вертикальная съёмка) ffmpeg применяет к кадрам сам.
    await run('ffmpeg', ['-v', 'error', '-y', '-i', srcFile, '-map', '0:v:0', '-map', '0:a:0?', ...filter, ...VIDEO_ARGS, outFile])
  }
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', outFile])
  // ffprobe 8 выводит поток дважды (ещё раз в группе потоков) — берётся первая строка.
  const [width, height] = stdout.trim().split('\n')[0].split(',').map(Number)

  const tmp = await mkdtemp(path.join(os.tmpdir(), 'poster-'))
  try {
    const posterFile = path.join(tmp, `${path.parse(name).name}.jpg`)
    await run('ffmpeg', ['-v', 'error', '-i', outFile, '-frames:v', '1', '-q:v', '2', posterFile])
    const poster = await processPhoto(posterFile, urlDir, srcMtime)
    return { ...poster, name, video: { src: `photos/${urlDir}/${outName}`, width, height } }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

// srcMtime — время исходника для проверки устаревших копий; у заставки видео — время самого видео.
async function processPhoto(srcFile, urlDir, srcMtime) {
  const outDir = path.join(outRoot, urlDir)
  const name = path.basename(srcFile)
  const base = urlSafe(path.parse(name).name)
  srcMtime ??= (await stat(srcFile)).mtimeMs

  // rotate() без аргументов применяет EXIF-ориентацию; метаданные (включая GPS) в результат не попадают.
  const image = sharp(srcFile).rotate()
  const meta = await image.metadata()
  const swap = (meta.orientation ?? 1) >= 5
  const origW = swap ? meta.height : meta.width
  const origH = swap ? meta.width : meta.height

  const srcSet = []
  for (const size of SIZES) {
    const scale = Math.min(1, size.long / Math.max(origW, origH))
    const width = Math.round(origW * scale)
    const height = Math.round(origH * scale)
    const ext = size.format === 'jpeg' ? 'jpg' : size.format
    const outName = `${base}-${size.long}.${ext}`
    const outFile = path.join(outDir, outName)

    const outStat = await stat(outFile).catch(() => null)
    if (!outStat || outStat.mtimeMs < srcMtime) {
      await image.clone().resize({ width, height }).toFormat(size.format, size.options).toFile(outFile)
    }
    // Путь без ведущего «/»: префикс base добавляется при сборке (src/data.ts, scripts/prerender.mjs).
    srcSet.push({ src: `photos/${urlDir}/${outName}`, width, height })
  }

  const largest = srcSet.at(-1)
  return { name, width: largest.width, height: largest.height, srcSet }
}

async function listImages(dir) {
  const entries = await readdir(dir).catch(() => null)
  if (entries === null) return null
  return entries
    .filter((f) => INPUT_EXT.has(path.extname(f).toLowerCase()) || VIDEO_EXT.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}
