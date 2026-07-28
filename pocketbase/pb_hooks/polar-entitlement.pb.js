/// <reference path="../pb_data/types.d.ts" />

// Reconciles access when the browser returns before a webhook has arrived, or
// when a webhook was missed. The frontend intentionally calls this endpoint
// before authRefresh: PocketBase's cached auth record is not a source of truth
// for a payment that happened in another tab or device.
routerAdd(
  'POST',
  '/entitlement/polar/refresh',
  (e) => {
    const user = e.auth
    const email = String(user.get('email') || '').trim().toLowerCase()
    if (!email) return e.json(200, { entitled: false, source: 'no-email' })

    if (user.get('entitled') === true) return e.json(200, { entitled: true, source: 'account' })

    // Complimentary access is an entitlement too. Keeping this check here
    // means founder/test grants do not depend on a checkout or a webhook.
    try {
      const now = new Date().toISOString()
      const compGrant = $app.findFirstRecordByFilter(
        'atlas_polar_comp_access',
        'email_normalized = {:email} && active = true && (expires_at = "" || expires_at >= {:now})',
        { email, now },
      )
      if (compGrant) {
        user.set('entitled', true)
        $app.save(user)
        return e.json(200, { entitled: true, source: 'complimentary-access' })
      }
    } catch {
      // The optional complimentary-access collection may not be deployed yet.
    }

    const accessToken = $os.getenv('POLAR_ACCESS_TOKEN')
    if (!accessToken) return e.json(200, { entitled: false, source: 'unconfigured' })

    const headers = {
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/json',
    }

    try {
      // Polar supports an exact customer-email filter. We then query orders by
      // customer id, which avoids scanning every order in the organization.
      const customersRes = $http.send({
        url: 'https://api.polar.sh/v1/customers?email=' + encodeURIComponent(email) + '&limit=10',
        method: 'GET',
        headers,
      })
      if (customersRes.statusCode >= 400) return e.json(200, { entitled: false, source: 'polar-unavailable' })

      const customersPayload = customersRes.json || {}
      const customers = customersPayload.items || []
      for (const customer of customers) {
        if (!customer || !customer.id) continue
        const ordersRes = $http.send({
          url: 'https://api.polar.sh/v1/orders?customer_id=' + encodeURIComponent(customer.id) + '&limit=100&sorting=-created_at',
          method: 'GET',
          headers,
        })
        if (ordersRes.statusCode >= 400) continue
        const ordersPayload = ordersRes.json || {}
        const hasPaidOrder = (ordersPayload.items || []).some(
          (order) => order && order.paid === true && order.status !== 'refunded' && order.status !== 'void',
        )
        if (hasPaidOrder) {
          user.set('entitled', true)
          $app.save(user)
          return e.json(200, { entitled: true, source: 'polar-order' })
        }
      }
    } catch (error) {
      console.error('Polar entitlement reconciliation failed: ' + error)
      return e.json(200, { entitled: false, source: 'polar-unavailable' })
    }

    return e.json(200, { entitled: false, source: 'no-paid-order' })
  },
  $apis.requireAuth(),
)
