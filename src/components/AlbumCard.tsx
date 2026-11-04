import { Link } from 'react-router'
import { pickSize, type PhotoEntry } from '../data.ts'

export function AlbumCard({ to, cover, date, title, count }: {
  to: string
  cover?: PhotoEntry
  date?: string
  title: string
  count: string
}) {
  const img = cover && pickSize(cover, 1000)
  return (
    <Link to={to} className="album-card">
      {img && <img src={img.src} width={img.width} height={img.height} alt="" loading="lazy" />}
      {date && <span className="album-card__date">{date}</span>}
      <span className="album-card__title">{title}</span>
      <span className="album-card__count">{count}</span>
    </Link>
  )
}
