import { pb } from './pocketbase'

// Static fallback checkout link (created via Polar MCP -- product id
// 1bf30516-1449-4b67-8fdb-c5616d5d4232, org "Landnam Ventures"). Used only
// if the dynamic PocketBase-hosted checkout below fails or is unreachable,
// so the paywall CTA has some working link rather than nothing. Leave blank
// to no-op the CTA entirely once the dynamic route is confirmed working.
export const POLAR_CHECKOUT_URL = import.meta.env.VITE_POLAR_CHECKOUT_URL as string | undefined

// Starts a Polar checkout session server-side (pocketbase/pb_hooks/polar-checkout.pb.js)
// prefilled with the signed-in user's email, and returns its hosted checkout
// URL. Requires an authenticated PocketBase session -- callers must only
// invoke this for a signed-in user.
export async function startPolarCheckout(): Promise<string> {
  const res = await pb.send<{ url: string }>('/checkout/polar', { method: 'POST' })
  return res.url
}
