import { useEffect } from 'react'
import { Link } from 'react-router'
import { coverOf, formatDate, puzzleAlbums, puzzlePhotos, siteConfig } from '../data.ts'
import { AlbumCard } from '../components/AlbumCard.tsx'
import { SiteFooter } from '../components/SiteFooter.tsx'
import { useNoSelect } from '../useNoSelect.ts'

export function PuzzleHome() {
  useEffect(() => {
    document.title = `Puzzle Me · ${siteConfig.title}`
  }, [])
  useNoSelect()

  return (
    <>
      <header className="home-header">
        <h1>Puzzle Me</h1>
        <p>
          <Link to="/albums/">← All albums</Link>
        </p>
      </header>

      <main className="album-list">
        {puzzleAlbums.map((album) => {
          const photos = puzzlePhotos(album).length
          return (
            <AlbumCard
              key={album.slug}
              to={`/puzzle/${album.slug}/`}
              cover={coverOf(album)}
              date={formatDate(album.date)}
              title={album.title}
              count={`${photos} ${photos === 1 ? 'photo' : 'photos'}`}
            />
          )
        })}
      </main>
      <SiteFooter />
    </>
  )
}
