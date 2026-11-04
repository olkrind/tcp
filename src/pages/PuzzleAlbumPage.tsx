import { useEffect, useMemo, useState } from 'react'
import { MasonryPhotoAlbum, type Photo } from 'react-photo-album'
import 'react-photo-album/masonry.css'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Puzzle } from '../components/Puzzle.tsx'
import { SiteFooter } from '../components/SiteFooter.tsx'
import { pickSize, puzzleAlbums, puzzlePhotos, siteConfig } from '../data.ts'
import { formatTime, loadGame, loadResults, puzzleKey, resetPuzzle } from '../puzzle.ts'
import { useNoSelect } from '../useNoSelect.ts'
import { NotFound } from './NotFound.tsx'

export function PuzzleAlbumPage() {
  const { slug, tab } = useParams()
  const album = puzzleAlbums.find((a) => a.slug === slug)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const all = useMemo(() => (album ? puzzlePhotos(album) : []), [album])

  // Игра открывается по ?photo=<имя файла>: «Назад» в браузере возвращает к сетке.
  const photo = all.find((p) => p.name === params.get('photo'))

  // Сохранённые игры и результаты перечитываются при возврате из игры и после сброса.
  const [resets, setResets] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)
  const saved = useMemo(
    () =>
      new Map(
        album && !photo && resets >= 0
          ? all.map((p) => {
              const key = puzzleKey(album.slug, p.name)
              return [p.name, { game: loadGame(key), results: loadResults(key) }]
            })
          : [],
      ),
    [album, all, photo, resets],
  )
  // Continue — начатые и не собранные, последняя игра первой; Done — собранные хоть раз, последний собранный первым.
  const [started, done] = useMemo(() => {
    const last = (name: string) => saved.get(name)?.results.at(-1)?.at ?? 0
    return [
      all
        .filter((p) => {
          const game = saved.get(p.name)?.game
          return game && game.solvedIn === undefined
        })
        .sort((a, b) => (saved.get(b.name)?.game?.updatedAt ?? 0) - (saved.get(a.name)?.game?.updatedAt ?? 0)),
      all.filter((p) => saved.get(p.name)?.results.length).sort((a, b) => last(b.name) - last(a.name)),
    ]
  }, [all, saved])
  const tabs = useMemo(
    () => [
      { slug: '', title: 'All photos', photos: all },
      { slug: 'continue', title: `Continue · ${started.length}`, photos: started, empty: 'No puzzles in progress.' },
      { slug: 'done', title: `Done · ${done.length}`, photos: done, empty: 'No solved puzzles yet.' },
    ],
    [all, started, done],
  )
  const current = tabs.find((t) => t.slug === (tab ?? ''))
  const visible = useMemo(() => current?.photos ?? [], [current])

  const photos = useMemo<Photo[]>(
    () =>
      visible.map((p) => ({
        key: p.name,
        src: pickSize(p, 1000).src,
        width: p.width,
        height: p.height,
        srcSet: p.srcSet,
        alt: p.name,
      })),
    [visible],
  )

  useEffect(() => {
    if (album) document.title = `${album.title} · Puzzle Me · ${siteConfig.title}`
  }, [album])

  useNoSelect()

  if (!album || !current) return <NotFound />

  if (photo)
    return (
      <Puzzle
        key={photo.name}
        storageKey={puzzleKey(album.slug, photo.name)}
        photo={photo}
        // Открыта по прямой ссылке — назад к сетке, иначе на шаг назад в истории.
        onExit={() => (window.history.state?.idx > 0 ? navigate(-1) : setParams({}, { replace: true }))}
      />
    )

  const badge = (name: string) => {
    const { game, results } = saved.get(name) ?? {}
    const result = results?.at(-1)
    if (current.slug === 'done' && result) return `✓ ${result.n} · ${formatTime(result.time)}`
    if (game && game.solvedIn === undefined) return `${game.placed.length} / ${game.n}`
    return result ? `✓ ${result.n} / ${result.n}` : null
  }

  // Сброс в два нажатия: первое меняет надпись на кнопке, второе стирает игры и результаты альбома.
  const reset = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 4000)
      return
    }
    for (const p of all) resetPuzzle(puzzleKey(album.slug, p.name))
    setConfirmReset(false)
    setResets((r) => r + 1)
    if (current.slug) navigate(`/puzzle/${album.slug}/`, { replace: true })
  }

  return (
    <>
      <header className="home-header">
        <h1>{album.title}</h1>
        <p>
          <Link to="/puzzle/">← Puzzle Me</Link> · Choose a photo
          {(started.length > 0 || done.length > 0) && (
            <>
              {' · '}
              <button className={`puzzle-reset${confirmReset ? ' puzzle-reset--confirm' : ''}`} onClick={reset}>
                {confirmReset ? 'Tap again to reset' : 'Reset progress'}
              </button>
            </>
          )}
        </p>
      </header>

      {/* Вкладка видна, пока в ней есть пазлы или она открыта */}
      {(started.length > 0 || done.length > 0 || current.slug) && (
        <div className="toolbar toolbar--tabs">
          <nav className="tabs">
            {tabs
              .filter((t) => !t.slug || t.photos.length > 0 || t === current)
              .map((t) => (
                <Link
                  key={t.slug}
                  to={`/puzzle/${album.slug}/${t.slug && `${t.slug}/`}`}
                  replace
                  className={`tabs__link${t === current ? ' tabs__link--active' : ''}`}
                >
                  {t.title}
                </Link>
              ))}
          </nav>
        </div>
      )}

      <main className="gallery gallery--puzzle">
        {visible.length === 0 ? (
          <p className="empty puzzle-empty">{current.empty}</p>
        ) : (
          <MasonryPhotoAlbum
            photos={photos}
            spacing={album.spacing ?? 2}
            columns={(width) => (width < 600 ? 2 : width < 1400 ? 3 : 4)}
            sizes={{ size: '1200px', sizes: [{ viewport: '(max-width: 1232px)', size: 'calc(100vw - 32px)' }] }}
            onClick={({ index }) => setParams({ photo: visible[index].name })}
            render={{
              extras: (_, { index }) => {
                const label = badge(visible[index].name)
                return label && <span className="puzzle-badge">{label}</span>
              },
            }}
          />
        )}
      </main>
      <SiteFooter />
    </>
  )
}
