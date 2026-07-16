import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SharePage } from './views/SharePage.tsx'
import { initAnalytics } from './lib/analytics.ts'

initAnalytics()

function SharePageRoute() {
  const { remoteId } = useParams<{ remoteId: string }>()
  return <SharePage remoteId={remoteId!} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/p/:remoteId" element={<SharePageRoute />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
