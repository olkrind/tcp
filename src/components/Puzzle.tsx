import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { pickSize, type PhotoEntry } from '../data.ts'
import {
  addResult,
  buildPuzzle,
  formatTime,
  keepResults,
  loadGame,
  loadResults,
  newGame,
  PUZZLE_SIZES,
  saveGame,
  type Game,
  type Piece,
} from '../puzzle.ts'

interface Drag {
  id: number
  from: 'tray' | 'board'
  pointerId: number
  /** точка захвата внутри части, px */
  ox: number
  oy: number
  sx: number
  sy: number
  x: number
  y: number
  started: boolean
}

const formatDay = (ms: number) => new Date(ms).toLocaleDateString('ru-RU')

// На телефоне 96 частей меньше пальца.
const PHONE_SIZES = [12, 24, 48]
const TRAY_PIECE = 72
// Отступ кадра от краёв поля, px.
const FRAME_PAD = 16

function PieceCanvas({ piece, img, scale, className, style, onPointerDown }: {
  piece: Piece
  img: HTMLImageElement
  scale: number
  className?: string
  style?: CSSProperties
  onPointerDown?: (e: PointerEvent<HTMLCanvasElement>) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const k = scale * (window.devicePixelRatio || 1)
    canvas.width = Math.ceil(piece.bw * k)
    canvas.height = Math.ceil(piece.bh * k)
    ctx.setTransform(k, 0, 0, k, -piece.bx * k, -piece.by * k)
    ctx.save()
    ctx.clip(piece.path)
    ctx.drawImage(img, 0, 0)
    ctx.restore()
    ctx.lineWidth = 1 / scale
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.stroke(piece.path)
  }, [piece, img, scale])
  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width: piece.bw * scale, height: piece.bh * scale, ...style }}
      onPointerDown={onPointerDown}
    />
  )
}

function SparklesIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 5Q10.9 12.1 18 13Q10.9 13.9 10 21Q9.1 13.9 2 13Q9.1 12.1 10 5Z" />
      <path d="M18.5 2Q18.9 4.6 21.5 5Q18.9 5.4 18.5 8Q18.1 5.4 15.5 5Q18.1 4.6 18.5 2Z" />
    </svg>
  )
}

export function Puzzle({ storageKey, photo, onExit }: { storageKey: string; photo: PhotoEntry; onExit: () => void }) {
  const [game, setGame] = useState(() => loadGame(storageKey))
  const [choosing, setChoosing] = useState(game === null)
  const [hint, setHint] = useState(false)
  const [results, setResults] = useState(() => loadResults(storageKey))
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [area, setArea] = useState({ w: 0, h: 0 })
  const [dragId, setDragId] = useState<number | null>(null)
  const [sizes] = useState(() => (window.matchMedia('(max-width: 600px)').matches ? PHONE_SIZES : PUZZLE_SIZES))
  const playRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const floatRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  // Время считается с последнего хода; между ходами копится в elapsed.
  const sessionStart = useRef(0)
  useEffect(() => {
    sessionStart.current = Date.now()
  }, [])

  const src = pickSize(photo, 1600).src
  useEffect(() => {
    const image = new Image()
    image.onload = () => setImg(image)
    image.src = src
    return () => {
      image.onload = null
    }
  }, [src])

  useLayoutEffect(() => {
    const el = playRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setArea({ w: entry.contentRect.width, h: entry.contentRect.height }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Страница под игрой не прокручивается и не тянется на iOS.
  useEffect(() => {
    document.documentElement.classList.add('puzzle-open')
    return () => document.documentElement.classList.remove('puzzle-open')
  }, [])

  const n = game?.n
  const seed = game?.seed
  const shape = useMemo(
    () => (img && n !== undefined && seed !== undefined ? buildPuzzle(img.naturalWidth, img.naturalHeight, n, seed) : null),
    [img, n, seed],
  )

  const scale = shape ? Math.max(0.01, Math.min((area.w - 2 * FRAME_PAD) / shape.width, (area.h - 2 * FRAME_PAD) / shape.height)) : 1
  const frame = shape && {
    left: (area.w - shape.width * scale) / 2,
    top: (area.h - shape.height * scale) / 2,
    width: shape.width * scale,
    height: shape.height * scale,
  }
  const trayScale = shape ? TRAY_PIECE / Math.max(shape.pieces[0].bw, shape.pieces[0].bh) : 1

  const commit = (next: Game) => {
    const now = Date.now()
    next = { ...next, elapsed: next.elapsed + now - sessionStart.current, updatedAt: now }
    sessionStart.current = now
    if (next.placed.length === next.n && next.solvedIn === undefined) {
      next.solvedIn = next.elapsed
      setResults(addResult(storageKey, { n: next.n, time: next.solvedIn, at: now }))
    }
    saveGame(storageKey, next)
    setGame(next)
  }

  const start = (size: number) => {
    sessionStart.current = Date.now()
    keepResults(storageKey)
    const next = { ...newGame(size), updatedAt: Date.now() }
    saveGame(storageKey, next)
    setGame(next)
    setChoosing(false)
    setHint(false)
  }

  const moveFloat = () => {
    const d = drag.current
    if (d && floatRef.current) floatRef.current.style.transform = `translate(${d.x - d.ox}px, ${d.y - d.oy}px)`
  }
  useLayoutEffect(moveFloat, [dragId])

  const drop = (d: Drag) => {
    const g = game
    const play = playRef.current?.getBoundingClientRect()
    const tray = trayRef.current?.getBoundingClientRect()
    if (!g || !shape || !frame || !play || !tray) return
    const p = shape.pieces[d.id]
    const rest = { ...g, tray: g.tray.filter((i) => i !== d.id), loose: g.loose.filter(([i]) => i !== d.id) }

    // Отпущена над лентой — обратно в ленту, в начало.
    if (d.y >= tray.top) {
      if (d.from === 'board') commit({ ...rest, tray: [d.id, ...rest.tray] })
      return
    }

    const margin = p.x - p.bx
    let left = d.x - d.ox - play.left
    let top = d.y - d.oy - play.top
    const cx = (left - frame.left) / scale + margin
    const cy = (top - frame.top) / scale + margin
    // Примагничивается, если клетка смещена от своего места меньше чем на треть.
    const tolerance = Math.min(p.w, p.h) / 3
    if (Math.abs(cx - p.x) < tolerance && Math.abs(cy - p.y) < tolerance) {
      commit({ ...rest, placed: [...rest.placed, d.id] })
      return
    }
    left = Math.min(Math.max(left, 0), area.w - p.bw * scale)
    top = Math.min(Math.max(top, 0), area.h - p.bh * scale)
    commit({ ...rest, loose: [...rest.loose, [d.id, (left - frame.left) / scale + margin, (top - frame.top) / scale + margin]] })
  }

  const grab = (e: PointerEvent<HTMLElement>, id: number, from: Drag['from']) => {
    if (e.button !== 0 || !shape || drag.current) return
    window.getSelection()?.removeAllRanges()
    const p = shape.pieces[id]
    const rect = e.currentTarget.getBoundingClientRect()
    // Из ленты часть берётся за середину и сразу в размер поля; с поля — за точку касания.
    const fromTray = from === 'tray'
    const d: Drag = {
      id,
      from,
      pointerId: e.pointerId,
      ox: fromTray ? (p.bw * scale) / 2 : e.clientX - rect.left,
      oy: fromTray ? (p.bh * scale) / 2 : e.clientY - rect.top,
      sx: e.clientX,
      sy: e.clientY,
      x: e.clientX,
      y: e.clientY,
      // В ленте пальцем: движение вбок прокручивает ленту, вверх — берёт часть.
      started: !fromTray || e.pointerType === 'mouse',
    }
    drag.current = d
    if (d.started) setDragId(id)
    if (e.pointerType === 'mouse') e.preventDefault()

    const end = () => {
      drag.current = null
      setDragId(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    const move = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== d.pointerId) return
      d.x = ev.clientX
      d.y = ev.clientY
      if (!d.started) {
        const dx = d.x - d.sx
        const dy = d.y - d.sy
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) return end()
        if (dy > -10) return
        d.started = true
        setDragId(id)
      }
      moveFloat()
    }
    const up = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== d.pointerId) return
      end()
      if (d.started) drop(d)
    }
    const cancel = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId === d.pointerId) end()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  const solved = game?.solvedIn !== undefined
  const thumb = pickSize(photo, 640)

  return (
    <div className="puzzle">
      <div className="puzzle__bar">
        <button className="puzzle__back" onClick={onExit}>
          ← Photos
        </button>
        {game && (
          <span className="puzzle__count">
            {game.placed.length} / {game.n}
          </span>
        )}
        <button
          className={`puzzle__icon${hint ? ' puzzle__icon--on' : ''}`}
          aria-label="Hint"
          aria-pressed={hint}
          title="Hint"
          disabled={!game || solved}
          onClick={() => setHint((h) => !h)}
        >
          <SparklesIcon on={hint} />
        </button>
        <button className="toolbar__btn" onClick={() => setChoosing(true)}>
          New
        </button>
      </div>

      <div className="puzzle__play" ref={playRef}>
        {shape && frame && img && game && (
          <>
            <div className="puzzle__frame" style={frame}>
              <img
                className={`puzzle__hint${hint ? ' puzzle__hint--on' : ''}${solved ? ' puzzle__hint--solved' : ''}`}
                src={src}
                alt=""
                draggable={false}
              />
            </div>
            {game.placed.map((id) => {
              const p = shape.pieces[id]
              return (
                <PieceCanvas
                  key={id}
                  piece={p}
                  img={img}
                  scale={scale}
                  className="puzzle__piece puzzle__piece--placed"
                  style={{ left: frame.left + p.bx * scale, top: frame.top + p.by * scale }}
                />
              )
            })}
            {game.loose.map(([id, x, y]) => {
              const p = shape.pieces[id]
              return (
                <PieceCanvas
                  key={id}
                  piece={p}
                  img={img}
                  scale={scale}
                  className="puzzle__piece puzzle__piece--loose"
                  style={{
                    left: frame.left + (x - p.x + p.bx) * scale,
                    top: frame.top + (y - p.y + p.by) * scale,
                    visibility: dragId === id ? 'hidden' : undefined,
                  }}
                  onPointerDown={(e) => grab(e, id, 'board')}
                />
              )
            })}
          </>
        )}
        {!choosing && !img && <p className="puzzle__status">Loading…</p>}
      </div>

      {solved ? (
        <div className="puzzle__done">
          <span>
            {game.n} pieces · solved in {formatTime(game.solvedIn!)}
            {game.updatedAt !== undefined && ` · ${formatDay(game.updatedAt)}`}
          </span>
          {results.length > 1 && (
            <ol className="puzzle__results" aria-label="Earlier results">
              {results
                .slice(0, -1)
                .reverse()
                .slice(0, 5)
                .map((r, i) => (
                  <li key={i}>
                    {r.n} pieces · {formatTime(r.time)}
                    {r.at !== undefined && ` · ${formatDay(r.at)}`}
                  </li>
                ))}
            </ol>
          )}
          <button className="toolbar__btn" onClick={() => setChoosing(true)}>
            Play again
          </button>
          <button className="toolbar__btn toolbar__btn--primary" onClick={onExit}>
            Other photo
          </button>
        </div>
      ) : (
        <div
          className="puzzle__tray"
          ref={trayRef}
          onWheel={(e) => {
            if (trayRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) trayRef.current.scrollLeft += e.deltaY
          }}
        >
          {shape &&
            img &&
            game?.tray.map((id) => (
              <div
                key={id}
                className="puzzle__slot"
                style={{ visibility: dragId === id ? 'hidden' : undefined }}
                onPointerDown={(e) => grab(e, id, 'tray')}
              >
                <PieceCanvas piece={shape.pieces[id]} img={img} scale={trayScale} />
              </div>
            ))}
        </div>
      )}

      {dragId !== null && shape && img && (
        <div className="puzzle__float" ref={floatRef}>
          <PieceCanvas piece={shape.pieces[dragId]} img={img} scale={scale} />
        </div>
      )}

      {choosing && (
        <div className="puzzle__dialog">
          <img src={thumb.src} width={thumb.width} height={thumb.height} alt="" draggable={false} />
          <p>How many pieces?</p>
          <div className="puzzle__sizes">
            {sizes.map((size) => (
              <button key={size} className="toolbar__btn" onClick={() => start(size)}>
                {size}
              </button>
            ))}
          </div>
          {game && !solved && (
            <button className="puzzle__back puzzle__back--dialog" onClick={() => setChoosing(false)}>
              Continue current puzzle
            </button>
          )}
        </div>
      )}
    </div>
  )
}
