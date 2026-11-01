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
import { coverOf, findAlbum, formatDate, photoCount, pickSize, sectionPath, siteConfig } from '../data.ts'
import { NotFound } from './NotFound.tsx'

const LIGHT_LIGHTBOX = {
  container: { backgroundColor: '#fff' },
  root: {
    '--yarl__color_backdrop': '#fff',
    '--yarl__color_button': 'rgba(30, 30, 30, 0.8)',
    '--yarl__color_button_active': '#1e1e1e',
    '--yarl__color_button_disabled': 'rgba(30, 30, 30, 0.3)',
    '--yarl__button_filter': 'none',
    '--yarl__counter_color': '#1e1e1e',
    '--yarl__counter_filter': 'none',
  },
}

export function AlbumPage() {
  const { slug, section: sectionSlug } = useParams()
  const album = findAlbum(slug)
  const [params, setParams] = useSearchParams()
  const galleryRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const section = album?.sections && (sectionSlug ? album.sections.find((s) => s.slug === sectionSlug) : album.sections[0])
  const pageUrl = `${window.location.origin}${import.meta.env.BASE_URL}${(album && section ? sectionPath(album, section) : `/albums/${slug}/`).slice(1)}`
  const downloadable = album?.downloadable !== false

  const visible = useMemo(
    () => (album ? (section ? album.photos.filter((p) => p.section === section.slug) : album.photos) : []),
    [album, section],
  )

  const photos = useMemo<Photo[]>(
    () =>
      visible.map((p) => {
        const preview = pickSize(p, 1000)
        return { key: p.name, src: preview.src, width: p.width, height: p.height, srcSet: p.srcSet, alt: p.name }
      }),
    [visible],
  )

  const slides = useMemo<Slide[]>(
    () =>
      visible.map((p) => {
        const full = p.srcSet[p.srcSet.length - 1]
        return {
          src: full.src,
          width: p.width,
          height: p.height,
          srcSet: p.srcSet,
          download: downloadable && { url: full.src, filename: p.name.replace(/\.\w+$/, '.jpg') },
          share: { url: `${pageUrl}?photo=${encodeURIComponent(p.name)}` },
        }
      }),
    [visible, pageUrl, downloadable],
  )

  // Открытое фото хранится в ?photo=<имя файла>, чтобы ссылку на кадр можно было переслать.
  const openName = params.get('photo')
  const openIndex = visible.findIndex((p) => p.name === openName)

  const setOpen = (index: number) =>
    setParams(index >= 0 ? { photo: visible[index].name } : {}, { replace: true, preventScrollReset: true })

  useEffect(() => {
    if (!album) return
    document.title = section && section !== album.sections?.[0] ? `${section.title}. ${album.title}` : album.title
  }, [album, section])

  // При переключении вкладки страница не возвращается к обложке: панель с вкладками остаётся вверху экрана.
  useEffect(() => {
    const toolbar = galleryRef.current
    if (toolbar && window.scrollY > toolbar.offsetTop) window.scrollTo({ top: toolbar.offsetTop })
    // На узком экране вкладки прокручиваются вбок: активная должна быть видна.
    toolbar?.querySelector('.tabs__link--active')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [section])

  // Без скачивания: меню «Сохранить изображение как…» не открывается ни в сетке, ни в просмотре
  // (просмотр рендерится вне страницы альбома, поэтому обработчик на document).
  useEffect(() => {
    if (downloadable) return
    const block = (e: MouseEvent) => {
      if (e.target instanceof HTMLImageElement) e.preventDefault()
    }
    document.addEventListener('contextmenu', block)
    document.body.classList.add('no-save')
    return () => {
      document.removeEventListener('contextmenu', block)
      document.body.classList.remove('no-save')
    }
  }, [downloadable])

  if (!album || (album.sections && !section)) return <NotFound />

  const cover = coverOf(album)
  const heroImg = cover && pickSize(cover, 2048)

  const share = async () => {
    const title = document.title
    if (navigator.share) {
      await navigator.share({ title, url: pageUrl }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(pageUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <section className="hero">
        {heroImg && (
          <img
            className="hero__img"
            src={heroImg.src}
            srcSet={cover.srcSet.map((s) => `${s.src} ${s.width}w`).join(', ')}
            sizes="100vw"
            alt=""
            style={{ filter: `brightness(${1 - (album.coverDim ?? 0.35)})`, objectPosition: album.coverPosition }}
          />
        )}
        <div className="hero__text">
          <time dateTime={album.date}>{formatDate(album.date)}</time>
          <h1>{album.title}</h1>
          <p>
            {siteConfig.title} · <Link to="/">{siteConfig.name}</Link> · <Link to="/albums/">All albums</Link>
          </p>
        </div>
        <button
          className="hero__down"
          aria-label="Scroll to photos"
          onClick={() => galleryRef.current?.scrollIntoView({ behavior: 'smooth' })}
        >
          ↓
        </button>
      </section>

      <div className={`toolbar${album.sections ? ' toolbar--tabs' : ''}`} ref={galleryRef}>
        {album.sections ? (
          <nav className="tabs">
            {album.sections.map((s) => (
              <Link
                key={s.slug}
                to={sectionPath(album, s)}
                preventScrollReset
                className={`tabs__link${s === section ? ' tabs__link--active' : ''}`}
              >
                {s.title}
              </Link>
            ))}
          </nav>
        ) : (
          <>
            <Link to="/albums/" className="toolbar__back">
              ← All albums
            </Link>
            <span className="toolbar__count">{photoCount(album.photos.length)}</span>
          </>
        )}
        <button className="toolbar__btn" onClick={share}>
          {copied ? 'Link copied' : 'Share'}
        </button>
        {album.archiveUrl && (
          <a className="toolbar__btn" href={album.archiveUrl}>
            Originals
          </a>
        )}
        {downloadable && <DownloadAllButton album={album} />}
      </div>

      <main className="gallery">
        <MasonryPhotoAlbum
          photos={photos}
          spacing={album.spacing ?? 4}
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
        plugins={downloadable ? [Counter, Download, Fullscreen, Share, Zoom] : [Counter, Fullscreen, Share, Zoom]}
        controller={{ closeOnBackdropClick: true }}
        styles={album.lightbox === 'light' ? LIGHT_LIGHTBOX : undefined}
      />

      <ScrollTopButton />
      <SiteFooter />
    </>
  )
}
