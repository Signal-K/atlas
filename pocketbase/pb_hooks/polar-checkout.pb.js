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
    const productId = $os.getenv('POLAR_PRODUCT_ID') || '1bf30516-1449-4b67-8fdb-c5616d5d4232'

    if (!accessToken || !successUrl) {
      console.error('POLAR_ACCESS_TOKEN or POLAR_SUCCESS_URL is not set; rejecting checkout request.')
      throw new BadRequestError('Checkout is not configured.')
    }

    const email = e.auth.get('email')

    let res
    try {
      res = $http.send({
        url: 'https://api.polar.sh/v1/checkouts/',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: productId,
          success_url: successUrl,
          customer_email: email,
        }),
      })
    } catch (err) {
      console.error('Polar checkout request failed: ' + err)
      throw new BadRequestError('Could not reach Polar.')
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
