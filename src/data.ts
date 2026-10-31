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
}

export interface Album {
  slug: string
  title: string
  date: string
  cover: string | null
  archiveUrl: string | null
  photos: PhotoEntry[]
}

const withBase = (src: string) => import.meta.env.BASE_URL + src

export const albums = (generated as Album[]).map((album) => ({
  ...album,
  photos: album.photos.map((p) => ({ ...p, srcSet: p.srcSet.map((s) => ({ ...s, src: withBase(s.src) })) })),
}))
export const siteConfig = site

export const findAlbum = (slug: string | undefined) => albums.find((a) => a.slug === slug)

export const coverOf = (album: Album) => album.photos.find((p) => p.name === album.cover) ?? album.photos[0]

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Ближайший размер не меньше нужной ширины.
export const pickSize = (photo: PhotoEntry, minWidth: number) =>
  photo.srcSet.find((s) => s.width >= minWidth) ?? photo.srcSet[photo.srcSet.length - 1]
