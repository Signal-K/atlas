import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
// Share pages are their own entry points -- someone opening the app never
// needs them, and someone opening a share link never needs the app shell.
const SharePage = lazy(() => import('./views/SharePage.tsx').then((m) => ({ default: m.SharePage })))
const CityStampSharePage = lazy(() =>
  import('./views/CityStampSharePage.tsx').then((m) => ({ default: m.CityStampSharePage })),
)
import { initAnalytics } from './lib/analytics.ts'

initAnalytics()

function SharePageRoute() {
  const { remoteId } = useParams<{ remoteId: string }>()
  return <SharePage remoteId={remoteId!} />
}

function CityStampSharePageRoute() {
  const { slug } = useParams<{ slug: string }>()
  return <CityStampSharePage slug={slug!} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/p/:remoteId" element={<SharePageRoute />} />
          <Route path="/stamps/:slug" element={<CityStampSharePageRoute />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
