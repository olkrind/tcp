import { useEffect } from 'react'
import { Link } from 'react-router'
import { albums, coverOf, formatDate, photoCount, puzzleAlbums, siteConfig } from '../data.ts'
import { AlbumCard } from '../components/AlbumCard.tsx'
import { SocialLinks } from '../components/SocialLinks.tsx'

export function Home() {
  useEffect(() => {
    document.title = `Albums · ${siteConfig.title}`
  }, [])

  return (
    <>
      <header className="home-header">
        <h1>{siteConfig.title}</h1>
        <p>
          <Link to="/">{siteConfig.name}</Link>
        </p>
        <SocialLinks />
      </header>

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
        {puzzleAlbums.length > 0 && (
          <AlbumCard
            to="/puzzle/"
            cover={coverOf(puzzleAlbums[0])}
            date="Game"
            title="Puzzle Me"
            count={`${puzzleAlbums.length} ${puzzleAlbums.length === 1 ? 'album' : 'albums'}`}
          />
        )}
      </main>
    </>
  )
}
