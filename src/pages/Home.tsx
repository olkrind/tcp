import { useEffect } from 'react'
import { albums, coverOf, formatDate, photoCount, siteConfig } from '../data.ts'
import { AlbumCard } from '../components/AlbumCard.tsx'
import { AlbumsHeader } from '../components/AlbumsHeader.tsx'

export function Home() {
  useEffect(() => {
    document.title = `Albums · ${siteConfig.title}`
  }, [])

  return (
    <>
      <AlbumsHeader active="/albums/" />

      <main className="album-list">
        {albums.length === 0 && <p className="empty">No albums yet.</p>}
        {albums.map((album) => (
          <AlbumCard
            key={album.slug}
            to={`/albums/${album.slug}/`}
            cover={coverOf(album)}
            date={formatDate(album.date)}
            title={album.title}
            count={photoCount(album.photos)}
          />
        ))}
      </main>
    </>
  )
}
