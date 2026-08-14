/// <reference path="../pb_data/types.d.ts" />

// CI-only counterpart to backend/clerk_exchange.go (see the "Atlas pb_hooks
// are CI-only, not prod" project note) -- this JS-hooks PocketBase instance
// backs e2e/pocketbase-write-actions.spec.ts, which drives a real Clerk
// sign-up against it (see AuthForm.tsx). Without this route the spec has no
// /auth/clerk-exchange to call at all and fails before ever reaching
// PocketBase. Mirrors the Go handler's matching/creation logic exactly;
// only the token verification differs (see below).
//
// Everything is declared inside the routerAdd callback -- PocketBase's
// JSVM does not preserve top-level declarations from the rest of this file
// when the callback runs (see polar.pb.js for the same note).
routerAdd('POST', '/auth/clerk-exchange', (e) => {
  const B64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

  // Decodes a base64url string (no padding) to a UTF-8 JS string.
  function base64UrlDecodeToString(str) {
    const bytes = []
    let buffer = 0
    let bits = 0
    for (let i = 0; i < str.length; i++) {
      const val = B64URL_CHARS.indexOf(str[i])
      if (val === -1) continue
      buffer = (buffer << 6) | val
      bits += 6
      if (bits >= 8) {
        bits -= 8
        bytes.push((buffer >> bits) & 0xff)
      }
    }
    let out = ''
    let i = 0
    while (i < bytes.length) {
      const b0 = bytes[i++]
      if (b0 < 0x80) {
        out += String.fromCharCode(b0)
      } else if (b0 >> 5 === 0x06) {
        const b1 = bytes[i++]
        out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f))
      } else if (b0 >> 4 === 0x0e) {
        const b1 = bytes[i++]
        const b2 = bytes[i++]
        out += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f))
      } else {
        const b1 = bytes[i++]
        const b2 = bytes[i++]
        const b3 = bytes[i++]
        let code = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)
        code -= 0x10000
        out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff))
      }
    }
    return out
  }

  const rawBody = readerToString(e.request.body)
  let payload = {}
  try {
    payload = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    throw new BadRequestError('An error occurred while loading the submitted data.')
  }

  const token = String(payload.token || '').trim()
  if (!token) {
    throw new BadRequestError('A Clerk session token is required.')
  }

  const secretKey = ($os.getenv('CLERK_SECRET_KEY') || '').trim()
  if (!secretKey) {
    throw new BadRequestError('Clerk sign-in is not enabled on this deployment.')
  }

  // No JWKS/RS256 verification here (goja has no usable crypto for that) --
  // this instance only ever exists as an ephemeral CI sandbox, never a real
  // deployment target, so the risk this accepts is a forged CI-only token,
  // not a production account takeover. The claimed user is still resolved
  // against Clerk's own Backend API below, same as the Go handler.
  const segments = token.split('.')
  if (segments.length !== 3) {
    throw new UnauthorizedError('Invalid or expired Clerk session.')
  }
  let claims
  try {
    claims = JSON.parse(base64UrlDecodeToString(segments[1]))
  } catch {
    throw new UnauthorizedError('Invalid or expired Clerk session.')
  }
  const clerkUserID = String(claims.sub || '')
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (!clerkUserID || (typeof claims.exp === 'number' && claims.exp < nowSeconds)) {
    throw new UnauthorizedError('Invalid or expired Clerk session.')
  }

  const userRes = $http.send({
    url: 'https://api.clerk.com/v1/users/' + encodeURIComponent(clerkUserID),
    method: 'GET',
    headers: { Authorization: 'Bearer ' + secretKey },
  })
  if (userRes.statusCode !== 200 || !userRes.json) {
    throw new ApiError(502, 'Could not look up Clerk user.', null)
  }
  const clerkUser = userRes.json

  let email = ''
  const addresses = clerkUser.email_addresses || []
  for (const addr of addresses) {
    if (addr.id === clerkUser.primary_email_address_id) {
      email = String(addr.email_address || '').trim().toLowerCase()
      break
    }
  }
  if (!email) {
    for (const addr of addresses) {
      if (addr.verification && addr.verification.status === 'verified') {
        email = String(addr.email_address || '').trim().toLowerCase()
        break
      }
    }
  }
  if (!email) {
    throw new BadRequestError('Your Clerk account needs a verified email address.')
  }

  const usersCollection = $app.findCollectionByNameOrId('users')

  let record
  let created = false
  try {
    record = $app.findFirstRecordByFilter('users', 'clerk_user_id = {:clerkUserID}', { clerkUserID })
  } catch {
    try {
      record = $app.findFirstRecordByFilter('users', 'email = {:email}', { email })
    } catch {
      record = new Record(usersCollection)
      record.set('email', email)
      record.setRandomPassword()
      created = true
    }
  }

  if (record.get('clerk_user_id') !== clerkUserID) {
    record.set('clerk_user_id', clerkUserID)
    $app.save(record)
  }

  return $apis.recordAuthResponse(e, record, 'clerk', { created })
})
