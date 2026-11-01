import { useEffect } from 'react'
import { Link } from 'react-router'
import { siteConfig } from '../data.ts'

const base = import.meta.env.BASE_URL

const ICONS: Record<string, string> = {
  Telegram: 'M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.9-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.3 13l-4.8-1.5c-1-.3-1.1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5Z',
  Instagram:
    'M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9-.1-1.3-.1-1.6-.1-4.8s0-3.6.1-4.8C2.4 4 3.9 2.4 7.2 2.3c1.2-.1 1.6-.1 4.8-.1ZM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0Zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9Z',
  Albums: 'M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z',
}

function Icon({ name }: { name: string }) {
  const d = ICONS[name]
  if (!d) return null
  return (
    <svg className="card__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export function CardPage() {
  useEffect(() => {
    document.title = siteConfig.author
  }, [])

  const links = siteConfig.links.filter((l) => l.href)

  return (
    <main className="card">
      <img className="card__avatar" src={`${base}avatar-400.jpg`} width={100} height={100} alt={siteConfig.name} />
      <h1 className="card__name">{siteConfig.name}</h1>
      <p className="card__title">{siteConfig.title}</p>
      <a className="card__phone" href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}>
        {siteConfig.phone}
      </a>

      <div className="card__buttons">
        <Link className="card__btn" to="/albums/">
          <Icon name="Albums" />
          Albums
        </Link>
        {links.map((l) => (
          <a key={l.label} className="card__btn" href={l.href} target="_blank" rel="noreferrer">
            <Icon name={l.label} />
            {l.label}
          </a>
        ))}
        <a className="card__btn card__btn--primary" href={`${base}contact.vcf`} download={`${siteConfig.name}.vcf`}>
          Save contact
        </a>
      </div>
    </main>
  )
}
