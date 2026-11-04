// Нарезка фото на части пазла. Координаты — в пикселях загруженного фото.

type Pt = [number, number]
// Кубическая кривая: две опорные точки и конец; начало — конец предыдущей.
type Seg = [Pt, Pt, Pt]

interface Edge {
  start: Pt
  segs: Seg[]
}

export interface Game {
  n: number
  seed: number
  /** части в ленте, по порядку */
  tray: number[]
  /** части на поле не на своём месте: id и место клетки на фото; последняя — сверху */
  loose: [number, number, number][]
  placed: number[]
  /** время игры, мс */
  elapsed: number
  solvedIn?: number
  /** последний ход, мс с 1970 — порядок во вкладке Continue */
  updatedAt?: number
}

export interface Piece {
  id: number
  /** клетка: место части на фото */
  x: number
  y: number
  w: number
  h: number
  /** рамка части с выступами */
  bx: number
  by: number
  bw: number
  bh: number
  path: Path2D
}

export interface PuzzleShape {
  width: number
  height: number
  pieces: Piece[]
}

// Выступ: x — вдоль кромки от точки выступа, y — наружу; в долях размера выступа.
const TAB: Seg[] = [
  [[-0.1, 0], [-0.08, 0.04], [-0.11, 0.1]],
  [[-0.16, 0.2], [-0.08, 0.26], [0, 0.26]],
  [[0.08, 0.26], [0.16, 0.2], [0.11, 0.1]],
  [[0.08, 0.04], [0.1, 0], [0.16, 0]],
]

// Выступы задаются seed: сохранённая игра восстанавливает те же формы.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const straight = (a: Pt, b: Pt): Edge => ({ start: a, segs: [[a, b, b]] })

function tabbed(a: Pt, b: Pt, size: number, rnd: () => number): Edge {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const u: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  const dir = rnd() < 0.5 ? -1 : 1
  const n: Pt = [-u[1] * dir, u[0] * dir]
  const mid = len / 2 + (rnd() - 0.5) * 0.1 * len
  const t = size * (0.9 + rnd() * 0.2)
  const at = ([fx, fy]: Pt): Pt => [
    a[0] + u[0] * (mid + fx * t) + n[0] * fy * t,
    a[1] + u[1] * (mid + fx * t) + n[1] * fy * t,
  ]
  const neckStart = at([-0.16, 0])
  const neckEnd = at([0.16, 0])
  return {
    start: a,
    segs: [[a, neckStart, neckStart], ...TAB.map((s) => s.map(at) as Seg), [neckEnd, b, b]],
  }
}

function reverse(e: Edge): Edge {
  const pts = [e.start, ...e.segs.map((s) => s[2])]
  return { start: pts[pts.length - 1], segs: e.segs.map((s, i): Seg => [s[1], s[0], pts[i]]).reverse() }
}

// Сетка из n частей, клетки которой ближе всего к квадрату.
function grid(n: number, width: number, height: number) {
  let best: [number, number] = [n, 1]
  let score = Infinity
  for (let cols = 1; cols <= n; cols++) {
    if (n % cols) continue
    const rows = n / cols
    const d = Math.abs(Math.log(width / cols / (height / rows)))
    if (d < score) [score, best] = [d, [cols, rows]]
  }
  return best
}

export function buildPuzzle(width: number, height: number, n: number, seed: number): PuzzleShape {
  const rnd = mulberry32(seed)
  const [cols, rows] = grid(n, width, height)
  const cw = width / cols
  const ch = height / rows
  const size = Math.min(cw, ch)
  // Выступ с разбросом размера — до 0.29 клетки.
  const margin = 0.3 * size
  const P = (c: number, r: number): Pt => [c * cw, r * ch]

  const horizontal = Array.from({ length: rows + 1 }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      r === 0 || r === rows ? straight(P(c, r), P(c + 1, r)) : tabbed(P(c, r), P(c + 1, r), size, rnd),
    ),
  )
  const vertical = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols + 1 }, (_, c) =>
      c === 0 || c === cols ? straight(P(c, r), P(c, r + 1)) : tabbed(P(c, r), P(c, r + 1), size, rnd),
    ),
  )

  const pieces: Piece[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const edges = [horizontal[r][c], vertical[r][c + 1], reverse(horizontal[r + 1][c]), reverse(vertical[r][c])]
      const path = new Path2D()
      path.moveTo(...edges[0].start)
      for (const e of edges) for (const [c1, c2, end] of e.segs) path.bezierCurveTo(...c1, ...c2, ...end)
      path.closePath()
      const [x, y] = P(c, r)
      pieces.push({
        id: pieces.length,
        x,
        y,
        w: cw,
        h: ch,
        bx: x - margin,
        by: y - margin,
        bw: cw + 2 * margin,
        bh: ch + 2 * margin,
        path,
      })
    }
  return { width, height, pieces }
}

export const PUZZLE_SIZES = [12, 24, 48, 96]

// Игра хранится в localStorage по фото: продолжается после закрытия страницы.
export const puzzleKey = (slug: string, photo: string) => `puzzle:${slug}/${photo}`

export function loadGame(key: string): Game | null {
  try {
    const g = JSON.parse(localStorage.getItem(key) ?? 'null')
    return g && PUZZLE_SIZES.includes(g.n) && Array.isArray(g.tray) && Array.isArray(g.loose) && Array.isArray(g.placed) ? g : null
  } catch {
    return null
  }
}

export function saveGame(key: string, game: Game) {
  try {
    localStorage.setItem(key, JSON.stringify(game))
  } catch {
    // Без localStorage (приватный режим) игра работает, но не сохраняется.
  }
}

export interface Result {
  n: number
  /** время сборки, мс */
  time: number
  /** когда собран, мс с 1970 */
  at?: number
}

// Результаты сборок — отдельно от игры: новая игра на том же фото их не стирает.
const resultsKey = (key: string) => key.replace(/^puzzle:/, 'puzzle-results:')

export function loadResults(key: string): Result[] {
  try {
    const results = JSON.parse(localStorage.getItem(resultsKey(key)) ?? 'null')
    if (Array.isArray(results)) return results
  } catch {
    return []
  }
  // Собранные до появления списка результатов — результат в самой игре.
  const game = loadGame(key)
  return game?.solvedIn !== undefined ? [{ n: game.n, time: game.solvedIn, at: game.updatedAt }] : []
}

function saveResults(key: string, results: Result[]) {
  try {
    localStorage.setItem(resultsKey(key), JSON.stringify(results))
  } catch {
    // Без localStorage результат не сохраняется.
  }
}

export function addResult(key: string, result: Result) {
  const results = [...loadResults(key), result]
  saveResults(key, results)
  return results
}

// Перед новой игрой: результат, записанный только в старой игре, переносится в список, иначе новая игра его сотрёт.
export function keepResults(key: string) {
  const results = loadResults(key)
  if (results.length) saveResults(key, results)
}

export function resetPuzzle(key: string) {
  try {
    localStorage.removeItem(key)
    localStorage.removeItem(resultsKey(key))
  } catch {
    // Без localStorage сбрасывать нечего.
  }
}

export function newGame(n: number): Game {
  const tray = [...Array(n).keys()]
  for (let i = tray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tray[i], tray[j]] = [tray[j], tray[i]]
  }
  return { n, seed: Math.floor(Math.random() * 2 ** 32), tray, loose: [], placed: [], elapsed: 0 }
}

export const formatTime = (ms: number) => {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`
}
