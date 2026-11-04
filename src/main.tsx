import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import { ScrollToTop } from './components/ScrollToTop.tsx'
import { AlbumPage } from './pages/AlbumPage.tsx'
import { CardPage } from './pages/CardPage.tsx'
import { Home } from './pages/Home.tsx'
import { NotFound } from './pages/NotFound.tsx'
import { PuzzleAlbumPage } from './pages/PuzzleAlbumPage.tsx'
import { PuzzleHome } from './pages/PuzzleHome.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<CardPage />} />
        <Route path="/albums" element={<Home />} />
        <Route path="/albums/:slug" element={<AlbumPage />} />
        <Route path="/albums/:slug/:section" element={<AlbumPage />} />
        <Route path="/puzzle" element={<PuzzleHome />} />
        <Route path="/puzzle/:slug" element={<PuzzleAlbumPage />} />
        <Route path="/puzzle/:slug/:tab" element={<PuzzleAlbumPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
