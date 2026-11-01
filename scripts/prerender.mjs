// После vite build: index.html визитки, списка альбомов и каждого альбома с собственными <title> и og-тегами;
// contact.vcf для визитки.
// Telegram и другие мессенджеры не выполняют JS и берут превью ссылки только из HTML.
// 404.html — копия index.html: GitHub Pages отдаёт её на неизвестные пути, дальше маршрут разбирает React.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const site = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'))
const albums = JSON.parse(await readFile(path.join(root, 'src', 'generated', 'albums.json'), 'utf8'))
const template = await readFile(path.join(dist, 'index.html'), 'utf8')

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function render({ title, description, url, image }) {
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    image && `<meta property="og:image" content="${escape(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ]
  return template.replace(/<title>.*?<\/title>/s, tags.filter(Boolean).join('\n    '))
}

const avatarPath = path.join(dist, 'avatar-400.jpg')
const avatar = await readFile(avatarPath).catch(() => null)

// Корень сайта — визитка.
await writeFile(
  path.join(dist, 'index.html'),
  render({
    title: site.author,
    description: [site.phone, ...site.links.filter((l) => l.href).map((l) => l.label)].join(' · '),
    url: `${site.siteUrl}/`,
    image: avatar && `${site.siteUrl}/avatar-1200.jpg`,
  }),
)

const firstCover = albums[0]?.photos.find((p) => p.name === albums[0].cover)
await mkdir(path.join(dist, 'albums'), { recursive: true })
await writeFile(
  path.join(dist, 'albums', 'index.html'),
  render({
    title: `Albums · ${site.title}`,
    description: site.author,
    url: `${site.siteUrl}/albums/`,
    image: firstCover && `${site.siteUrl}/${firstCover.srcSet.at(-1).src}`,
  }),
)

// Файл контакта для кнопки «Save contact». vCard 3.0: строки длиннее 75 символов переносятся с пробелом в начале,
// иначе iOS и Android обрезают фото и ссылки.
const fold = (line) => line.match(/.{1,74}/g).join('\r\n ')
const [first, ...rest] = site.name.split(' ')
const vcard = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  `N:${rest.join(' ')};${first};;;`,
  `FN:${site.name}`,
  `TITLE:${site.title}`,
  `TEL;TYPE=CELL:${site.phone.replace(/\s/g, '')}`,
  `URL:${site.siteUrl}/`,
  ...site.links.filter((l) => l.href).map((l) => `X-SOCIALPROFILE;TYPE=${l.label.toLowerCase()}:${l.href}`),
  avatar && `PHOTO;ENCODING=b;TYPE=JPEG:${avatar.toString('base64')}`,
  'END:VCARD',
]
  .filter(Boolean)
  .map(fold)
  .join('\r\n')
await writeFile(path.join(dist, 'contact.vcf'), vcard + '\r\n')

for (const album of albums) {
  const cover = album.photos.find((p) => p.name === album.cover)
  const dir = path.join(dist, 'albums', album.slug)
  await mkdir(dir, { recursive: true })
  await writeFile(
    path.join(dir, 'index.html'),
    render({
      title: album.title,
      description: site.author,
      url: `${site.siteUrl}/albums/${album.slug}/`,
      image: cover && `${site.siteUrl}/${cover.srcSet.at(-1).src}`,
    }),
  )
}

await writeFile(path.join(dist, '404.html'), template)
// Без .nojekyll GitHub Pages обрабатывает сайт Jekyll и не отдаёт файлы и папки, начинающиеся с «_».
await writeFile(path.join(dist, '.nojekyll'), '')
console.log(`prerender: ${albums.length} страниц(ы) альбомов`)
