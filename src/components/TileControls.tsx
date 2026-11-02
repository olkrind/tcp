import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { RenderButtonProps } from 'react-photo-album'

// Плитка сетки — div с role="button": кнопки «поделиться» и «скачать» внутри <button> недопустимы.
export function TileButton({ className, style, children, onClick, 'aria-label': ariaLabel }: RenderButtonProps) {
  // Обработчик сетки не читает событие: ему нужен только сам вызов.
  const open = (e: MouseEvent | KeyboardEvent) => onClick?.(e as MouseEvent<HTMLButtonElement>)
  return (
    <div
      className={className}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
        e.preventDefault()
        open(e)
      }}
    >
      {children}
    </div>
  )
}

// Полоса со значками внизу плитки по образцу: выезжает при наведении.
export function TileControls({ shareUrl, download }: { shareUrl: string; download?: { url: string; filename: string } }) {
  const [copied, setCopied] = useState(false)

  const share = async (e: MouseEvent) => {
    e.stopPropagation()
    if (navigator.share) {
      await navigator.share({ title: document.title, url: shareUrl }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="tile-controls" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button type="button" className="tile-controls__btn" title={copied ? 'Link copied' : 'Share'} onClick={share}>
        {copied ? (
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 9.5l4 4 8-9" />
          </svg>
        ) : (
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M11 3.5l5 4.5-5 4.5M16 8H9.5C5.5 8 2.5 10.5 2 15" />
          </svg>
        )}
      </button>
      {download && (
        <a className="tile-controls__btn" href={download.url} download={download.filename} title="Download">
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M9 2v10M4.5 7.5L9 12l4.5-4.5M3 16h12" />
          </svg>
        </a>
      )}
    </div>
  )
}
