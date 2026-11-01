import { Link } from 'react-router'
import { siteConfig } from '../data.ts'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>
        {siteConfig.title} · <Link to="/">{siteConfig.name}</Link>
      </span>
    </footer>
  )
}
