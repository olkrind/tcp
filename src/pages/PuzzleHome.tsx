import { useEffect } from 'react'
import { coverOf, formatDate, puzzleAlbums, puzzlePhotos, siteConfig } from '../data.ts'
import { AlbumCard } from '../components/AlbumCard.tsx'
import { AlbumsHeader } from '../components/AlbumsHeader.tsx'
import { useNoSelect } from '../useNoSelect.ts'

export function PuzzleHome() {
  useEffect(() => {
    document.title = `Puzzle Me · ${siteConfig.title}`
  }, [])
  useNoSelect()

  return (
    <>
      <AlbumsHeader active="/puzzle/" />

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
    </>
  )
}
