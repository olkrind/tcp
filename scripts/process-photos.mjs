// Готовит фото для сайта: photos-src/<slug>/* → public/photos/<slug>/ и src/generated/albums.json.
// Запуск: npm run photos. Уже обработанные файлы пропускаются, если исходник не новее.
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const srcRoot = path.join(root, 'photos-src')
const outRoot = path.join(root, 'public', 'photos')
const manifestPath = path.join(root, 'src', 'generated', 'albums.json')

// Размер — по длинной стороне. Последний — JPEG: его отдаёт кнопка «Скачать» и он же идёт в og:image.
// На 20 кадрах с плёночным зерном: ~28 + ~121 + ~291 КБ на фото.
const SIZES = [
  { long: 640, format: 'webp', options: { quality: 75 } },
  { long: 1600, format: 'webp', options: { quality: 75 } },
  { long: 2048, format: 'jpeg', options: { quality: 80, mozjpeg: true } },
]
const INPUT_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'])

const albums = JSON.parse(await readFile(path.join(root, 'content', 'albums.json'), 'utf8'))
const previous = await readJson(manifestPath, [])

const manifest = []
for (const album of albums) {
  const srcDir = path.join(srcRoot, album.slug)
  const files = await listImages(srcDir)

  if (files === null) {
    // Исходников нет (например, на другом компьютере) — берём прошлый результат.
    const old = previous.find((a) => a.slug === album.slug)
    if (old) manifest.push({ ...old, ...album, cover: old.cover })
    else console.warn(`⚠ ${album.slug}: нет ни photos-src/${album.slug}, ни данных в манифесте — альбом пропущен`)
    continue
  }

  const outDir = path.join(outRoot, album.slug)
  await mkdir(outDir, { recursive: true })

  const photos = []
  for (const [i, file] of files.entries()) {
    photos.push(await processPhoto(path.join(srcDir, file), outDir, album.slug))
    if (process.stdout.isTTY) process.stdout.write(`\r${album.slug}: ${i + 1}/${files.length}`)
  }
  console.log(`${process.stdout.isTTY ? '\r' : ''}${album.slug}: ${files.length} фото`)

  const cover = photos.find((p) => p.name === album.cover) ?? photos[0]
  manifest.push({ ...album, cover: cover?.name ?? null, photos })
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
}

async function processPhoto(srcFile, outDir, slug) {
  const name = path.basename(srcFile)
  const base = path.parse(name).name
  const srcMtime = (await stat(srcFile)).mtimeMs

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
    srcSet.push({ src: `photos/${slug}/${outName}`, width, height })
  }

  const largest = srcSet.at(-1)
  return { name, width: largest.width, height: largest.height, srcSet }
}

async function listImages(dir) {
  const entries = await readdir(dir).catch(() => null)
  if (entries === null) return null
  return entries
    .filter((f) => INPUT_EXT.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}
