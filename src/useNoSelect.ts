import { useEffect } from 'react'

// Раздел пазла: ни выделения текста, ни контекстного меню — ни на компьютере, ни на телефоне.
// Одного user-select: none мало: Firefox на iOS при перетаскивании всё равно выделяет подписи и показывает своё меню.
export function useNoSelect() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault()
    const clear = () => {
      const selection = document.getSelection()
      if (selection && !selection.isCollapsed) selection.removeAllRanges()
    }
    document.documentElement.classList.add('puzzle-section')
    document.addEventListener('selectstart', block)
    document.addEventListener('contextmenu', block)
    document.addEventListener('selectionchange', clear)
    return () => {
      document.documentElement.classList.remove('puzzle-section')
      document.removeEventListener('selectstart', block)
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('selectionchange', clear)
    }
  }, [])
}
