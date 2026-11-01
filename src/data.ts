import site from '../site.config.json'
import generated from './generated/albums.json'

export interface ImageSize {
  src: string
  width: number
  height: number
}

export interface PhotoEntry {
  name: string
  width: number
  height: number
  srcSet: ImageSize[]
  /** slug раздела — у альбомов с разделами */
  section?: string
}

export interface Section {
  slug: string
  title: string
}

export interface Album {
  slug: string
  title: string
  date: string
  cover: string | null
  /** обложка из отдельного файла, которого нет среди фото альбома */
  coverPhoto?: PhotoEntry
  /** какая часть обложки видна, если кадр не помещается целиком: CSS object-position, по умолчанию "50% 50%" */
  coverPosition?: string
  /** затемнение обложки, 0…1; по умолчанию 0.35 */
  coverDim?: number
  archiveUrl: string | null
  /** false — без кнопок скачивания, правого клика и перетаскивания фото */
  downloadable?: boolean
  /** промежуток между фото в сетке, px; по умолчанию 4 */
  spacing?: number
  /** "light" — просмотр фото на белом фоне */
  lightbox?: 'light' | 'dark'
  /** вкладки; первая открывается по адресу альбома, остальные — /albums/<slug>/<section>/ */
  sections?: Section[]
  photos: PhotoEntry[]
}

const withBase = (src: string) => import.meta.env.BASE_URL + src
const withBaseSrc = (p: PhotoEntry): PhotoEntry => ({ ...p, srcSet: p.srcSet.map((s) => ({ ...s, src: withBase(s.src) })) })

export const albums: Album[] = (generated as Album[]).map((album) => ({
  ...album,
  coverPhoto: album.coverPhoto && withBaseSrc(album.coverPhoto),
  photos: album.photos.map(withBaseSrc),
}))
export const siteConfig = site

export const findAlbum = (slug: string | undefined) => albums.find((a) => a.slug === slug)

export const coverOf = (album: Album) =>
  album.coverPhoto ?? album.photos.find((p) => p.name === album.cover) ?? album.photos[0]

export const sectionPath = (album: Album, section: Section) =>
  section === album.sections?.[0] ? `/albums/${album.slug}/` : `/albums/${album.slug}/${section.slug}/`

// ДД.ММ.ГГГГ независимо от языка браузера.
export const formatDate = (iso: string) => iso.split('-').reverse().join('.')

export const photoCount = (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`

// Ближайший размер не меньше нужной ширины.
export const pickSize = (photo: PhotoEntry, minWidth: number) =>
  photo.srcSet.find((s) => s.width >= minWidth) ?? photo.srcSet[photo.srcSet.length - 1]
