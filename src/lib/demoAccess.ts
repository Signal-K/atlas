import { trackEvent } from './analytics'
import { pb } from './pocketbase'

const STORAGE_KEY = 'atlas-demo-access-code'
const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,79}$/i

function normalizeCode(value: string | null | undefined): string | null {
  const code = value?.trim()
  if (!code || !CODE_PATTERN.test(code)) return null
  return code.toLowerCase()
}

export function getStoredDemoAccessCode(): string | null {
  return normalizeCode(localStorage.getItem(STORAGE_KEY))
}

export function clearStoredDemoAccessCode() {
  localStorage.removeItem(STORAGE_KEY)
}

export function captureDemoAccessCodeFromUrl(location: Pick<Location, 'pathname' | 'search'> = window.location): string | null {
  const params = new URLSearchParams(location.search)
  const queryCode = normalizeCode(params.get('demo') ?? params.get('access') ?? params.get('atlas_demo'))
  const pathMatch = location.pathname.match(/^\/(?:demo|access|invite)\/([^/?#]+)/i)
  const pathCode = normalizeCode(pathMatch?.[1])
  const code = queryCode ?? pathCode
  if (!code) return null

  localStorage.setItem(STORAGE_KEY, code)
  trackEvent('Captured demo access code', { source: queryCode ? 'query' : 'path' })
  return code
}

export async function redeemStoredDemoAccessCode(): Promise<'none' | 'redeemed' | 'failed'> {
  const code = getStoredDemoAccessCode()
  if (!code || !pb.authStore.isValid) return 'none'

  try {
    await pb.send('/atlas/demo-access/redeem', {
      method: 'POST',
      body: { code },
    })
    clearStoredDemoAccessCode()
    await pb.collection('users').authRefresh()
    trackEvent('Redeemed demo access code')
    return 'redeemed'
  } catch {
    trackEvent('Demo access code redeem failed')
    return 'failed'
  }
}
