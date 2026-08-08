import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { refreshEntitlement, refreshEntitlementAfterCheckout, useAuth } from '../lib/auth'
import { identifyAnalyticsUser } from '../lib/analytics'

// Keeps entitlement state in sync with the server and identifies the
// current user to analytics.
export function useEntitlementSync() {
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Polar redirects back to `/app/account?checkout={CHECKOUT_ID}` after a
  // purchase, but the `entitled` flag on the cached authStore record is
  // only as fresh as the last sign-in/refresh -- without this, a completed
  // purchase would look unpaid until the next manual refresh. Strip the
  // param after refreshing so it doesn't re-trigger on every render.
  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search)
    if (!params.has('checkout')) return
    params.delete('checkout')
    const search = params.toString()
    navigate({ pathname: routerLocation.pathname, search: search ? `?${search}` : '' }, { replace: true })
    void refreshEntitlementAfterCheckout()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the checkout param appearing
  }, [routerLocation.search])

  // Pick up server-side entitlement changes when a user returns to this tab
  // after completing checkout or an administrator reconciles a missed order.
  useEffect(() => {
    if (!user) return
    void refreshEntitlement()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshEntitlement()
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
    // `user` is a new object on every authStore change, including the
    // refreshEntitlement() call this effect itself triggers -- depending on
    // it re-fires the effect on every refresh, looping refreshEntitlement()
    // forever. Depend on the id so this only reruns on an actual sign-in/out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    identifyAnalyticsUser(user)
  }, [user])
}
