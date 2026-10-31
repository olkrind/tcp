import { Link } from 'react-router'

export function NotFound() {
  return (
    <main className="not-found">
      <h1>Page not found</h1>
      <Link to="/">Back to all albums</Link>
    </main>
  )
}
