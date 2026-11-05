import { TAB, type Pt } from '../puzzle.ts'

// Плитка 200×200 из 2×2 клеток: стыки на 50 и 150 px, чтобы линии и выступы не обрезались краем плитки.
// Выступ на краю (центр 0 и 200) рисуется дважды — половины сходятся у соседних плиток.
const CELL = 100
const TAB_SIZE = 90

function seam([ax, ay]: Pt, [bx, by]: Pt, dir: number) {
  const len = Math.hypot(bx - ax, by - ay)
  const [ux, uy] = [(bx - ax) / len, (by - ay) / len]
  const [nx, ny] = [-uy * dir, ux * dir]
  const at = ([fx, fy]: Pt) =>
    `${(ax + ux * (len / 2 + fx * TAB_SIZE) + nx * fy * TAB_SIZE).toFixed(1)} ${(ay + uy * (len / 2 + fx * TAB_SIZE) + ny * fy * TAB_SIZE).toFixed(1)}`
  return `M${ax} ${ay}L${at([-0.16, 0])}${TAB.map((s) => `C${s.map(at).join(' ')}`).join('')}L${bx} ${by}`
}

const half = CELL / 2
const SEAMS = [
  [100, 1, -1],
  [0, -1, 1],
  [200, -1, 1],
]
  .flatMap(([c, d1, d2]) => [
    seam([c - half, 50], [c + half, 50], d1),
    seam([c - half, 150], [c + half, 150], d2),
    seam([50, c - half], [50, c + half], -d1),
    seam([150, c - half], [150, c + half], -d2),
  ])
  .join('')

// Узор шапки раздела пазла. Элемент SVG, а не CSS-фон: картинку-фон Safari растрирует один раз,
// и при увеличении пальцами линии размываются. Наклон — в самом узоре: повёрнутый CSS-слой
// браузер перерисовывает при прокрутке, и узор дрожит.
export function PuzzleSeams() {
  return (
    <svg className="puzzle-seams" aria-hidden="true">
      <defs>
        <pattern id="puzzle-seams" width="200" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
          <path d={SEAMS} fill="none" stroke="#000" strokeOpacity="0.1" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#puzzle-seams)" />
    </svg>
  )
}
