/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  'POST',
  '/atlas/demo-access/redeem',
  (e) => {
    const rawBody = readerToString(e.request.body)
    let payload = {}
    try {
      payload = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      throw new BadRequestError('Invalid redeem payload.')
    }

    const code = String(payload.code || '')
      .trim()
      .toLowerCase()
    if (!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(code)) {
      throw new BadRequestError('Invalid demo access code.')
    }

    const user = e.auth
    const email = String(user.get('email') || '')
      .trim()
      .toLowerCase()
    const now = new Date().toISOString()

    let link
    try {
      link = $app.findFirstRecordByFilter(
        'atlas_demo_access_links',
        'code = {:code} && active = true && (expires_at = "" || expires_at >= {:now})',
        { code, now },
      )
    } catch {
      throw new BadRequestError('Demo access code not found.')
    }

    const maxRedemptions = Number(link.get('max_redemptions') || 0)
    const redemptionCount = Number(link.get('redemption_count') || 0)
    if (maxRedemptions > 0 && redemptionCount >= maxRedemptions) {
      throw new BadRequestError('Demo access code has already been fully redeemed.')
    }

    try {
      $app.findFirstRecordByFilter('atlas_demo_access_redemptions', 'user = {:user} && link = {:link}', {
        user: user.id,
        link: link.id,
      })
    } catch {
      const redemptions = $app.findCollectionByNameOrId('atlas_demo_access_redemptions')
      const redemption = new Record(redemptions)
      redemption.set('link', link.id)
      redemption.set('user', user.id)
      redemption.set('email_normalized', email)
      redemption.set('code', code)
      redemption.set('reason', link.get('reason') || 'demo_access')
      $app.save(redemption)

      link.set('redemption_count', redemptionCount + 1)
      $app.save(link)
    }

    user.set('entitled', true)
    $app.save(user)

    return e.json(200, { ok: true, entitled: true })
  },
  $apis.requireAuth(),
)
