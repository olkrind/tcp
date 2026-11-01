import { useEffect, useMemo, useRef, useState } from 'react'
import { MasonryPhotoAlbum, type Photo } from 'react-photo-album'
import 'react-photo-album/masonry.css'
import { Link, useParams, useSearchParams } from 'react-router'
import Lightbox, { type Slide } from 'yet-another-react-lightbox'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import 'yet-another-react-lightbox/plugins/counter.css'
import Download from 'yet-another-react-lightbox/plugins/download'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Share from 'yet-another-react-lightbox/plugins/share'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import { DownloadAllButton } from '../components/DownloadAllButton.tsx'
import { ScrollTopButton } from '../components/ScrollTopButton.tsx'
import { SiteFooter } from '../components/SiteFooter.tsx'
import { SocialLinks } from '../components/SocialLinks.tsx'
import { coverOf, findAlbum, formatDate, photoCount, pickSize, siteConfig } from '../data.ts'
import { NotFound } from './NotFound.tsx'

export function AlbumPage() {
  const { slug } = useParams()
  const album = findAlbum(slug)
  const [params, setParams] = useSearchParams()
  const galleryRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const albumUrl = `${window.location.origin}${import.meta.env.BASE_URL}albums/${slug}/`

  const photos = useMemo<Photo[]>(
    () =>
      album?.photos.map((p) => {
        const preview = pickSize(p, 1000)
        return { key: p.name, src: preview.src, width: p.width, height: p.height, srcSet: p.srcSet, alt: p.name }
      }) ?? [],
    [album],
  )

  const slides = useMemo<Slide[]>(
    () =>
      album?.photos.map((p) => {
        const full = p.srcSet[p.srcSet.length - 1]
        return {
          src: full.src,
          width: p.width,
          height: p.height,
          srcSet: p.srcSet,
          download: { url: full.src, filename: p.name.replace(/\.\w+$/, '.jpg') },
          share: { url: `${albumUrl}?photo=${encodeURIComponent(p.name)}` },
        }
      }) ?? [],
    [album, albumUrl],
  )

  // Открытое фото хранится в ?photo=<имя файла>, чтобы ссылку на кадр можно было переслать.
  const openName = params.get('photo')
  const openIndex = album ? album.photos.findIndex((p) => p.name === openName) : -1

  const setOpen = (index: number) =>
    setParams(index >= 0 && album ? { photo: album.photos[index].name } : {}, { replace: true, preventScrollReset: true })

  useEffect(() => {
    if (album) document.title = album.title
  }, [album])

  if (!album) return <NotFound />

  const cover = coverOf(album)
  const heroImg = cover && pickSize(cover, 2048)

  const shareAlbum = async () => {
    if (navigator.share) {
      await navigator.share({ title: album.title, url: albumUrl }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(albumUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <section className="hero">
        {heroImg && <img className="hero__img" src={heroImg.src} srcSet={cover.srcSet.map((s) => `${s.src} ${s.width}w`).join(', ')} sizes="100vw" alt="" />}
        <div className="hero__text">
          <time dateTime={album.date}>{formatDate(album.date)}</time>
          <h1>{album.title}</h1>
          <p>
            {siteConfig.title} · <Link to="/">{siteConfig.name}</Link> · <Link to="/albums/">All albums</Link>
          </p>
          <SocialLinks className="social-links--hero" />
        </div>
        <button
          className="hero__down"
          aria-label="Scroll to photos"
          onClick={() => galleryRef.current?.scrollIntoView({ behavior: 'smooth' })}
        >
          ↓
        </button>
      </section>

      <div className="toolbar" ref={galleryRef}>
        <Link to="/albums/" className="toolbar__back">
          ← All albums
        </Link>
        <span className="toolbar__count">{photoCount(album.photos.length)}</span>
        <button className="toolbar__btn" onClick={shareAlbum}>
          {copied ? 'Link copied' : 'Share'}
        </button>
        {album.archiveUrl && (
          <a className="toolbar__btn" href={album.archiveUrl}>
            Originals
          </a>
        )}
        <DownloadAllButton album={album} />
      </div>

      <main className="gallery">
        <MasonryPhotoAlbum
          photos={photos}
          spacing={4}
          columns={(width) => (width < 600 ? 1 : width < 1400 ? 2 : 3)}
          sizes={{ size: '1200px', sizes: [{ viewport: '(max-width: 1232px)', size: 'calc(100vw - 32px)' }] }}
          onClick={({ index }) => setOpen(index)}
        />
      </main>

      <Lightbox
        open={openIndex >= 0}
        index={Math.max(openIndex, 0)}
        slides={slides}
        close={() => setOpen(-1)}
        on={{ view: ({ index }) => openIndex >= 0 && index !== openIndex && setOpen(index) }}
        plugins={[Counter, Download, Fullscreen, Share, Zoom]}
        controller={{ closeOnBackdropClick: true }}
      />

      <ScrollTopButton />
      <SiteFooter />
    </>
  )
}
