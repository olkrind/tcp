import { Link } from 'react-router'
import { siteConfig } from '../data.ts'
import { PuzzleSeams } from './PuzzleSeams.tsx'
import { SocialLinks } from './SocialLinks.tsx'

const TABS = [
  { to: '/albums/', title: 'Albums' },
  { to: '/puzzle/', title: 'Puzzle Me' },
]

// Шапка списка альбомов и списка Puzzle Me: одна и та же, отличается активной вкладкой.
export function AlbumsHeader({ active }: { active: '/albums/' | '/puzzle/' }) {
  return (
    <>
      <header className="home-header">
        {active === '/puzzle/' && <PuzzleSeams />}
        <h1>{siteConfig.title}</h1>
        <p>
          <Link to="/">{siteConfig.name}</Link>
        </p>
        <SocialLinks />
      </header>
      <div className="toolbar toolbar--tabs">
        <nav className="tabs">
          {TABS.map((t) => (
            <Link key={t.to} to={t.to} className={`tabs__link${t.to === active ? ' tabs__link--active' : ''}`}>
              {t.title}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
