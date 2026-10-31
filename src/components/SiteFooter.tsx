import { siteConfig } from '../data.ts'

export function SiteFooter() {
  const links = siteConfig.links.filter((l) => l.href)
  return (
    <footer className="site-footer">
      <span>{siteConfig.author}</span>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
          {l.label}
        </a>
      ))}
    </footer>
  )
}
