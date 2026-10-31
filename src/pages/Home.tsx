import { useEffect } from 'react'
import { Link } from 'react-router'
import { albums, coverOf, formatDate, pickSize, siteConfig } from '../data.ts'
import { SiteFooter } from '../components/SiteFooter.tsx'

export function Home() {
  useEffect(() => {
    document.title = siteConfig.title
  }, [])

  return (
    <>
      <header className="home-header">
        <h1>{siteConfig.title}</h1>
        <p>{siteConfig.author}</p>
      </header>

      <main className="album-list">
        {albums.length === 0 && <p className="empty">Альбомов пока нет — см. README, раздел «Новый альбом».</p>}
        {albums.map((album) => {
          const cover = coverOf(album)
          const img = cover && pickSize(cover, 1000)
          return (
            <Link key={album.slug} to={`/albums/${album.slug}/`} className="album-card">
              {img && <img src={img.src} width={img.width} height={img.height} alt="" loading="lazy" />}
              <span className="album-card__date">{formatDate(album.date)}</span>
              <span className="album-card__title">{album.title}</span>
              <span className="album-card__count">{album.photos.length} фото</span>
            </Link>
          )
        })}
      </main>

      <SiteFooter />
    </>
  )
}
