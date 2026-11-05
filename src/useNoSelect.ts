import { useEffect } from 'react'

// Раздел пазла: текст не выделяется (CSS, класс puzzle-section), контекстное меню не открывается.
// Долгое касание на iOS отменяется в самой игре (Puzzle.tsx, touchstart).
export function useNoSelect() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault()
    document.documentElement.classList.add('puzzle-section')
    document.addEventListener('contextmenu', block)
    return () => {
      document.documentElement.classList.remove('puzzle-section')
      document.removeEventListener('contextmenu', block)
    }
  }, [])
}
