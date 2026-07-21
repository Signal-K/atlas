/// <reference path="../pb_data/types.d.ts" />

// Server-side counterpart to the static VITE_POLAR_CHECKOUT_URL link: creates
// a Polar checkout session on demand for the signed-in user and hands back
// its hosted checkout URL. Lives here (not a Cloudflare Pages Function)
// because Atlas itself is a static SPA with no server component (AT-012) --
// PocketBase is already the one server in this stack, and it already owns
// the Polar integration (see polar.pb.js's order.paid webhook, which flips
// `entitled` once this checkout is completed).
//
// Prefilling `customer_email` from the authenticated PocketBase user means
// the webhook can match the resulting order back to this user without
// asking them to re-type an email Polar might normalize differently.
routerAdd(
  'POST',
  '/checkout/polar',
  (e) => {
    const accessToken = $os.getenv('POLAR_ACCESS_TOKEN')
    const successUrl = $os.getenv('POLAR_SUCCESS_URL')
    // Atlas Sky Pass, org "Landnam Ventures" -- see .env.example.
    // Polar models different subscription intervals as separate products, so
    // the default checkout presents monthly, yearly, lifetime, and the legacy
    // one-time product side-by-side. POLAR_PRODUCT_ID is kept as a legacy
    // single-product override; POLAR_PRODUCT_IDS can override the full list.
    const legacyProductId = $os.getenv('POLAR_PRODUCT_ID')
    const productIdsEnv = $os.getenv('POLAR_PRODUCT_IDS')
    const defaultProductIds = [
      '7e023cdd-0172-4312-b0b7-251281ba8d1e', // Atlas Sky Pass Monthly, CHF 4/mo
      'ad9d6d76-7994-497d-a624-8f7a5c7f68c3', // Atlas Sky Pass Yearly, CHF 40/yr
      '352cfa25-638e-4f6e-bbcf-00e4d4b12854', // Atlas Sky Pass Lifetime, CHF 55
      '1bf30516-1449-4b67-8fdb-c5616d5d4232', // Legacy Atlas Sky Pass, CHF 5 one-time
    ]
    const defaultCompProductId = '352cfa25-638e-4f6e-bbcf-00e4d4b12854'
    const productIds = productIdsEnv
      ? productIdsEnv
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id)
      : legacyProductId
        ? [legacyProductId]
        : defaultProductIds

    if (!accessToken || !successUrl) {
      console.error('POLAR_ACCESS_TOKEN or POLAR_SUCCESS_URL is not set; rejecting checkout request.')
      throw new BadRequestError('Checkout is not configured.')
    }

    const email = e.auth.get('email')
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const allowDiscountCodes = $os.getenv('POLAR_ALLOW_DISCOUNT_CODES') !== 'false'
    const now = new Date().toISOString()
    let compGrant = null

    try {
      compGrant = $app.findFirstRecordByFilter(
        'atlas_polar_comp_access',
        'email_normalized = {:email} && active = true && (expires_at = "" || expires_at >= {:now})',
        { email: normalizedEmail, now },
      )
    } catch {
      // The collection is optional until its migration is deployed. Missing or
      // empty comp access should never block a normal paid checkout.
      compGrant = null
    }

    const discountId = compGrant ? String(compGrant.get('discount_id') || '').trim() : ''

    const checkoutBody =
      productIds.length > 1
        ? {
            products: productIds,
            success_url: successUrl,
            customer_email: email,
          }
        : {
            product_id: productIds[0],
            success_url: successUrl,
            customer_email: email,
          }

    if (discountId) {
      const compProductId = String($os.getenv('POLAR_COMP_PRODUCT_ID') || defaultCompProductId).trim()
      delete checkoutBody.products
      checkoutBody.product_id = compProductId
      checkoutBody.discount_id = discountId
      checkoutBody.allow_discount_codes = false
      checkoutBody.customer_metadata = {
        atlas_comp_access_id: compGrant.id,
        atlas_comp_access_reason: compGrant.get('reason') || 'comped',
      }
    } else {
      checkoutBody.allow_discount_codes = allowDiscountCodes
    }

    const createCheckout = (body) =>
      $http.send({
        url: 'https://api.polar.sh/v1/checkouts/',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

    let res
    try {
      res = createCheckout(checkoutBody)
    } catch (err) {
      console.error('Polar checkout request failed: ' + err)
      throw new BadRequestError('Could not reach Polar.')
    }

    if (res.statusCode >= 400) {
      if (discountId) {
        console.error(
          'Polar checkout creation with comp discount failed; retrying without discount_id ' +
            discountId +
            ': ' +
            res.statusCode +
            ' ' +
            res.raw,
        )
        const retryBody = Object.assign({}, checkoutBody, { allow_discount_codes: true })
        delete retryBody.discount_id
        delete retryBody.customer_metadata
        try {
          res = createCheckout(retryBody)
        } catch (err) {
          console.error('Polar checkout retry failed: ' + err)
          throw new BadRequestError('Could not reach Polar.')
        }
      }
    }

    if (res.statusCode >= 400) {
      console.error('Polar checkout creation failed: ' + res.statusCode + ' ' + res.raw)
      throw new BadRequestError('Could not start checkout.')
    }

    const checkout = res.json
    if (!checkout || !checkout.url) {
      console.error('Polar checkout response missing url: ' + res.raw)
      throw new BadRequestError('Could not start checkout.')
    }

    return e.json(200, { url: checkout.url })
  },
  $apis.requireAuth(),
)
