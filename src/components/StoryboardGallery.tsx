import type { ReactNode } from 'react'
import type { Photo } from 'react-photo-album'
import { TileButton } from './TileControls.tsx'

// Ряды по правилу образца (замер 71 ряда): ряд закрывается на 3 кадрах, если среди них есть горизонтальный,
// иначе на 4-м кадре. Кадры не обрезаются, ряд — на всю ширину, высота ряда по пропорциям кадров.
function storyboardRows(photos: Photo[]) {
  const rows: number[][] = []
  let row: number[] = []
  for (const i of photos.keys()) {
    row.push(i)
    const hasLandscape = row.some((j) => photos[j].width > photos[j].height)
    if (row.length === 4 || (row.length === 3 && hasLandscape)) {
      rows.push(row)
      row = []
    }
  }
  if (row.length) rows.push(row)
  return rows
}

export function StoryboardGallery({
  photos,
  spacing,
  onClick,
  extras,
}: {
  photos: Photo[]
  spacing: number
  onClick: (index: number) => void
  extras: (index: number) => ReactNode
}) {
  return (
    <div className="storyboard" style={{ gap: spacing }}>
      {storyboardRows(photos).map((row) => {
        const total = row.reduce((sum, i) => sum + photos[i].width / photos[i].height, 0)
        return (
          <div key={photos[row[0]].key} className="storyboard__row" style={{ gap: spacing }}>
            {row.map((i) => {
              const p = photos[i]
              const ratio = p.width / p.height
              // Ширина плитки = доля пропорции в ряду; flex-grow по пропорции даёт ряду одну высоту.
              return (
                <TileButton
                  key={p.key}
                  className="storyboard__tile"
                  style={{ flex: `${ratio} 1 0`, aspectRatio: `${p.width} / ${p.height}` }}
                  aria-label={p.alt}
                  onClick={() => onClick(i)}
                >
                  <img
                    className="storyboard__img"
                    src={p.src}
                    srcSet={p.srcSet?.map((s) => `${s.src} ${s.width}w`).join(', ')}
                    sizes={`calc(min(100vw - 32px, 1200px) * ${(ratio / total).toFixed(3)})`}
                    alt={p.alt}
                    loading="lazy"
                    decoding="async"
                  />
                  {extras(i)}
                </TileButton>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
