import { siteConfig } from '../data.ts'
import { SocialLinks } from './SocialLinks.tsx'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>{siteConfig.author}</span>
      <SocialLinks />
    </footer>
  )
}
