import { Link } from 'react-router'

export function NotFound() {
  return (
    <main className="not-found">
      <h1>Страница не найдена</h1>
      <Link to="/">На главную</Link>
    </main>
  )
}
