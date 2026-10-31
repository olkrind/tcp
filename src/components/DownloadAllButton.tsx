import { useState } from 'react'
import type { Album } from '../data.ts'

// Архив собирается в браузере из опубликованных JPEG 2048 px: отдельный zip на хостинге не хранится.
export function DownloadAllButton({ album }: { album: Album }) {
  const [progress, setProgress] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  const download = async () => {
    setFailed(false)
    setProgress(0)
    try {
      const { downloadZip } = await import('client-zip')
      async function* files() {
        for (const [i, photo] of album.photos.entries()) {
          const largest = photo.srcSet[photo.srcSet.length - 1]
          const response = await fetch(largest.src)
          if (!response.ok) throw new Error(`${largest.src}: ${response.status}`)
          yield { name: photo.name.replace(/\.\w+$/, '.jpg'), input: response }
          setProgress(i + 1)
        }
      }
      const blob = await downloadZip(files()).blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${album.slug}.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (error) {
      console.error(error)
      setFailed(true)
    } finally {
      setProgress(null)
    }
  }

  const label =
    progress !== null ? `Архив: ${progress} / ${album.photos.length}` : failed ? 'Ошибка, повторить' : 'Скачать всё'

  return (
    <button className="toolbar__btn toolbar__btn--primary" onClick={download} disabled={progress !== null}>
      {label}
    </button>
  )
}
