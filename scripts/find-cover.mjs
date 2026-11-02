// Находит кадр по отпечатку картинки: какой файл из папок стоит обложкой на другом сайте и как он там обрезан.
//
// Отпечаток — яркости 12×16 картинки, снимаются в браузере на странице-образце:
//   const bmp = await createImageBitmap(await fetch(URL_КАРТИНКИ, { mode: 'cors' }).then((r) => r.blob()))
//   const c = new OffscreenCanvas(12, 16), x = c.getContext('2d'); x.drawImage(bmp, 0, 0, 12, 16)
//   const d = x.getImageData(0, 0, 12, 16).data, g = []
//   for (let i = 0; i < d.length; i += 4) g.push(Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]))
//   g.join(',') // плюс bmp.width и bmp.height — пропорция картинки
//
// Запуск:
//   node scripts/find-cover.mjs <отпечаток> <ширина/высота образца, напр. 0.75> <папка или файл>…
// Вывод — 5 лучших совпадений: файл, расхождение (до ~10 — тот же кадр, от ~30 — нет совпадения)
// и кадрирование в долях исходника (x, y, ширина, высота).
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const [fp, ratioArg, ...inputs] = process.argv.slice(2)
const target = fp.split(',').map(Number)
const ratio = Number(ratioArg)
const GW = 12, GH = 16, SIDE = 400

const files = []
for (const input of inputs) {
  if (!(await stat(input)).isDirectory()) {
    files.push(input)
    continue
  }
  for (const f of await readdir(input)) if (/\.(jpe?g|png|webp|tiff?)$/i.test(f)) files.push(path.join(input, f))
}

const results = []
for (const file of files) {
  const { data, info } = await sharp(file).rotate().resize(SIDE, SIDE, { fit: 'inside' }).greyscale().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height
  let best = null
  // Перебор кадрирований с пропорцией образца: от целого кадра до 60% его размера.
  for (let cw = Math.min(W, Math.round(H * ratio)); cw >= W * 0.6; cw -= 4) {
    const ch = Math.round(cw / ratio)
    if (ch > H) continue
    for (let x = 0; x + cw <= W; x += 3)
      for (let y = 0; y + ch <= H; y += 3) {
        let d = 0
        for (let j = 0; j < GH; j++)
          for (let i = 0; i < GW; i++) {
            const x0 = x + Math.floor((i * cw) / GW), x1 = x + Math.floor(((i + 1) * cw) / GW)
            const y0 = y + Math.floor((j * ch) / GH), y1 = y + Math.floor(((j + 1) * ch) / GH)
            let s = 0, n = 0
            for (let yy = y0; yy < y1; yy += 2) for (let xx = x0; xx < x1; xx += 2) (s += data[yy * W + xx]), n++
            d += Math.abs(s / n - target[j * GW + i])
          }
        if (!best || d < best.d) best = { d, x: x / W, y: y / H, w: cw / W, h: ch / H }
      }
  }
  if (best) results.push({ file, ...best, d: best.d / (GW * GH) })
}

results.sort((a, b) => a.d - b.d)
const pct = (v) => `${(v * 100).toFixed(1)}%`
for (const r of results.slice(0, 5))
  console.log(`${r.d.toFixed(1).padStart(5)}  ${r.file}  x=${pct(r.x)} y=${pct(r.y)} w=${pct(r.w)} h=${pct(r.h)}`)
