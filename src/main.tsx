import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SharePage } from './views/SharePage.tsx'
import { initAnalytics } from './lib/analytics.ts'

initAnalytics()

// STS-175: the app has no general router (App.tsx switches views via plain
// useState), but a public share card needs a real, bookmarkable/shareable
// URL that works before any app state exists. This one path is matched
// ahead of everything else rather than pulling in a router for a single
// route.
const shareMatch = window.location.pathname.match(/^\/p\/([^/]+)\/?$/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{shareMatch ? <SharePage remoteId={shareMatch[1]} /> : <App />}</StrictMode>,
)
