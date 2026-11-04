import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

// Переход на другую страницу открывает её сверху: роутер прокрутку не сбрасывает.
// Вкладки одного альбома (/albums/<slug>/<раздел>/, /puzzle/<slug>/continue/) — одна страница, «Назад» — без сброса.
export function ScrollToTop() {
  const page = useLocation().pathname.split('/').slice(0, 3).join('/')
  const navigationType = useNavigationType()
  const shown = useRef(page)
  useLayoutEffect(() => {
    if (shown.current !== page && navigationType !== 'POP') window.scrollTo(0, 0)
    shown.current = page
  }, [page, navigationType])
  return null
}
