import { siteConfig } from '../data.ts'

export function SocialLinks({ className = '' }: { className?: string }) {
  const links = siteConfig.links.filter((l) => l.href)
  if (links.length === 0) return null
  return (
    <nav className={`social-links ${className}`}>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
          {l.label}
        </a>
      ))}
    </nav>
  )
}
