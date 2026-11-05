import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { pickSize, type PhotoEntry } from '../data.ts'
import { Confetti } from './Confetti.tsx'
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

// Пауза ввода между ходами, которая идёт в зачёт времени сборки; дольше — отошли от игры.
const MAX_GAP = 5 * 60 * 1000
// Перерисовка частей после изменения окна — когда размер перестал меняться.
const REDRAW_DELAY = 150

const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max))

// Проверка попадания в контур части: прозрачные углы рамки не берут часть.
let hitContext: CanvasRenderingContext2D | null = null
const hitTest = (path: Path2D, x: number, y: number) =>
  (hitContext ??= document.createElement('canvas').getContext('2d'))?.isPointInPath(path, x, y) ?? true

function PieceCanvas({ piece, img, scale, className, style }: {
  piece: Piece
  img: HTMLImageElement
  scale: number
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  // При изменении окна масштаб меняется на каждом кадре: до перерисовки canvas растягивается CSS.
  const [drawScale, setDrawScale] = useState(scale)
  useEffect(() => {
    if (scale === drawScale) return
    const timer = setTimeout(() => setDrawScale(scale), REDRAW_DELAY)
    return () => clearTimeout(timer)
  }, [scale, drawScale])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const k = drawScale * (window.devicePixelRatio || 1)
    canvas.width = Math.ceil(piece.bw * k)
    canvas.height = Math.ceil(piece.bh * k)
    ctx.setTransform(k, 0, 0, k, -piece.bx * k, -piece.by * k)
    ctx.save()
    ctx.clip(piece.path)
    ctx.drawImage(img, 0, 0)
    ctx.restore()
    ctx.lineWidth = 1 / drawScale
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.stroke(piece.path)
  }, [piece, img, drawScale])
  return <canvas ref={ref} className={className} style={{ width: piece.bw * scale, height: piece.bh * scale, ...style }} />
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
  // Номер залпа конфетти; 0 — не было.
  const [confetti, setConfetti] = useState(0)
  const [results, setResults] = useState(() => loadResults(storageKey))
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [imgError, setImgError] = useState(false)
  const [attempt, setAttempt] = useState(0)
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
    // Пока вкладка скрыта или телефон заблокирован, время сборки не идёт.
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt) sessionStart.current += Date.now() - hiddenAt
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Escape закрывает окно выбора числа частей, если есть к чему вернуться.
  const hasGame = game !== null
  useEffect(() => {
    if (!choosing || !hasGame) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setChoosing(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choosing, hasGame])

  // Перетаскивание, прерванное выходом из игры, снимает свои слушатели и не сохраняет ход.
  const dragEnd = useRef<{ end?: () => void }>({})
  useEffect(() => {
    const holder = dragEnd.current
    return () => holder.end?.()
  }, [])

  const src = pickSize(photo, 1600).src
  useEffect(() => {
    const image = new Image()
    image.onload = () => setImg(image)
    // Ошибка воркера (сеть, суточный лимит) — сообщение и повтор вместо бесконечного «Loading…».
    image.onerror = () => setImgError(true)
    image.src = src
    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [src, attempt])

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

  // Место части, отложенной на поле, — в пределах поля: после поворота экрана или изменения окна она не уходит за край.
  const loosePosition = (p: Piece, x: number, y: number) =>
    frame && {
      left: clamp(frame.left + (x - p.x + p.bx) * scale, area.w - p.bw * scale),
      top: clamp(frame.top + (y - p.y + p.by) * scale, area.h - p.bh * scale),
    }

  // Отпускание части обрабатывается слушателем, созданным при нажатии: состояние — на момент отпускания.
  const live = useRef({ game, shape, frame, scale, area })
  useLayoutEffect(() => {
    live.current = { game, shape, frame, scale, area }
  })

  const commit = (next: Game) => {
    const now = Date.now()
    next = { ...next, elapsed: next.elapsed + Math.min(now - sessionStart.current, MAX_GAP), updatedAt: now }
    sessionStart.current = now
    if (next.placed.length === next.n && next.solvedIn === undefined) {
      next.solvedIn = next.elapsed
      setResults(addResult(storageKey, { n: next.n, time: next.solvedIn, at: now }))
      setConfetti((c) => c + 1)
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
    const { game: g, shape, frame, scale, area } = live.current
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

  // Из ленты часть берётся за середину и сразу в размер поля; с поля — за точку касания (ox, oy).
  const grab = (e: PointerEvent<HTMLElement>, id: number, from: Drag['from'], ox?: number, oy?: number) => {
    if (e.button !== 0 || !shape || drag.current) return
    window.getSelection()?.removeAllRanges()
    const p = shape.pieces[id]
    const fromTray = from === 'tray'
    const d: Drag = {
      id,
      from,
      pointerId: e.pointerId,
      ox: ox ?? (p.bw * scale) / 2,
      oy: oy ?? (p.bh * scale) / 2,
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
      dragEnd.current.end = undefined
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
    dragEnd.current.end = end
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  // Части на поле перебираются сверху вниз: нажатие берёт ту, в контур которой попало.
  const grabFromBoard = (e: PointerEvent<HTMLDivElement>) => {
    const play = playRef.current?.getBoundingClientRect()
    if (!game || !shape || !play) return
    const px = e.clientX - play.left
    const py = e.clientY - play.top
    for (let i = game.loose.length - 1; i >= 0; i--) {
      const [id, x, y] = game.loose[i]
      const p = shape.pieces[id]
      const pos = loosePosition(p, x, y)
      if (pos && hitTest(p.path, p.bx + (px - pos.left) / scale, p.by + (py - pos.top) / scale))
        return grab(e, id, 'board', px - pos.left, py - pos.top)
    }
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
        {/* Во время перетаскивания второй палец не начинает новую игру: отпускание части записало бы старую */}
        <button className="toolbar__btn" disabled={dragId !== null} onClick={() => setChoosing(true)}>
          New
        </button>
      </div>

      <div className="puzzle__play" ref={playRef} onPointerDown={grabFromBoard}>
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
                  style={{ ...loosePosition(p, x, y), visibility: dragId === id ? 'hidden' : undefined }}
                />
              )
            })}
          </>
        )}
        {!choosing && !img && (
          <div className="puzzle__status">
            {imgError ? (
              <p>
                The photo did not load.{' '}
                <button
                  className="puzzle-reset puzzle-reset--confirm"
                  onClick={() => {
                    setImgError(false)
                    setAttempt((a) => a + 1)
                  }}
                >
                  Try again
                </button>
              </p>
            ) : (
              <p>Loading…</p>
            )}
          </div>
        )}
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

      {confetti > 0 && <Confetti key={confetti} />}

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
          {/* Окно закрывает и панель с «← Photos»: без этих кнопок в режиме приложения из него не выйти */}
          <div className="puzzle__dialog-links">
            {game && (
              <button className="puzzle__back puzzle__back--dialog" onClick={() => setChoosing(false)}>
                {solved ? 'Back to result' : 'Continue current puzzle'}
              </button>
            )}
            <button className="puzzle__back puzzle__back--dialog" onClick={onExit}>
              ← Photos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
