/// <reference path="../pb_data/types.d.ts" />

// Receives Polar.sh's `order.paid` webhook and flips `entitled` on the
// matching PocketBase user, so the Atlas frontend can gate future events,
// planning, and community features behind a one-time purchase.
//
// Everything the handler needs is declared *inside* the routerAdd callback
// below -- PocketBase's JSVM does not preserve top-level function/const
// declarations from the rest of this file when the callback actually runs
// (verified empirically: a helper defined at module scope throws
// "ReferenceError: ... is not defined" from inside the handler, even on
// the very first request).
//
// Signature verification is also hand-rolled (HMAC-SHA256 + base64, over
// plain byte arrays) rather than using PocketBase JSVM's $security.hs256
// directly -- goja (the JS engine PocketBase embeds) re-encodes JS strings
// as UTF-8 when they cross into Go, which silently corrupts any byte >=
// 0x80 in a binary secret/body. Working in byte arrays end-to-end avoids
// that. Verified against Node's native crypto.createHmac for 200+ random
// vectors before landing here. See the Standard Webhooks spec (which Polar
// implements): the signed message is
// `{webhook-id}.{webhook-timestamp}.{raw body}`, HMAC'd with the
// base64-decoded portion of the `whsec_...` secret after that prefix.

routerAdd('POST', '/webhooks/polar', (e) => {
  const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  function base64Decode(str) {
    const clean = str.replace(/[^A-Za-z0-9+/=]/g, '')
    const bytes = []
    let buffer = 0
    let bits = 0
    for (let i = 0; i < clean.length; i++) {
      const c = clean[i]
      if (c === '=') break
      const val = B64_CHARS.indexOf(c)
      if (val === -1) continue
      buffer = (buffer << 6) | val
      bits += 6
      if (bits >= 8) {
        bits -= 8
        bytes.push((buffer >> bits) & 0xff)
      }
    }
    return bytes
  }

  function base64Encode(bytes) {
    let out = ''
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i]
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined
      out += B64_CHARS[b0 >> 2]
      out += B64_CHARS[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)]
      out += b1 === undefined ? '=' : B64_CHARS[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)]
      out += b2 === undefined ? '=' : B64_CHARS[b2 & 0x3f]
    }
    return out
  }

  // Encodes a JS string (arbitrary Unicode) into an array of UTF-8 byte values.
  function utf8Encode(str) {
    const bytes = []
    for (let i = 0; i < str.length; i++) {
      let code = str.codePointAt(i)
      if (code > 0xffff) i++ // consumed a surrogate pair
      if (code < 0x80) {
        bytes.push(code)
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
      } else if (code < 0x10000) {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
      } else {
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        )
      }
    }
    return bytes
  }

  function sha256(bytes) {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ]
    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]

    const bitLen = bytes.length * 8
    const padded = bytes.slice()
    padded.push(0x80)
    while (padded.length % 64 !== 56) padded.push(0)
    for (let i = 7; i >= 0; i--) padded.push((bitLen / Math.pow(2, i * 8)) & 0xff)

    function rotr(x, n) {
      return (x >>> n) | (x << (32 - n))
    }

    for (let chunk = 0; chunk < padded.length; chunk += 64) {
      const w = new Array(64).fill(0)
      for (let i = 0; i < 16; i++) {
        w[i] =
          ((padded[chunk + i * 4] << 24) |
            (padded[chunk + i * 4 + 1] << 16) |
            (padded[chunk + i * 4 + 2] << 8) |
            padded[chunk + i * 4 + 3]) >>>
          0
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
      }
      let [a, b, c, d, e2, f, g, hh] = h
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e2, 6) ^ rotr(e2, 11) ^ rotr(e2, 25)
        const ch = (e2 & f) ^ (~e2 & g)
        const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
        const maj = (a & b) ^ (a & c) ^ (b & c)
        const temp2 = (S0 + maj) >>> 0
        hh = g
        g = f
        f = e2
        e2 = (d + temp1) >>> 0
        d = c
        c = b
        b = a
        a = (temp1 + temp2) >>> 0
      }
      h = [
        (h[0] + a) >>> 0,
        (h[1] + b) >>> 0,
        (h[2] + c) >>> 0,
        (h[3] + d) >>> 0,
        (h[4] + e2) >>> 0,
        (h[5] + f) >>> 0,
        (h[6] + g) >>> 0,
        (h[7] + hh) >>> 0,
      ]
    }

    const out = []
    for (const word of h) {
      out.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff)
    }
    return out
  }

  function hmacSha256(keyBytes, msgBytes) {
    const blockSize = 64
    let key = keyBytes.slice()
    if (key.length > blockSize) key = sha256(key)
    while (key.length < blockSize) key.push(0)

    const opad = key.map((b) => b ^ 0x5c)
    const ipad = key.map((b) => b ^ 0x36)
    const inner = sha256(ipad.concat(msgBytes))
    return sha256(opad.concat(inner))
  }

  // Constant-time-ish byte comparison so a timing side-channel can't help
  // an attacker guess a valid signature one byte at a time.
  function bytesEqual(a, b) {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  }

  const secretEnv = $os.getenv('POLAR_WEBHOOK_SECRET')
  if (!secretEnv) {
    console.error('POLAR_WEBHOOK_SECRET is not set; rejecting Polar webhook.')
    throw new BadRequestError('Webhook receiver is not configured.')
  }

  const webhookId = e.request.header.get('Webhook-Id')
  const webhookTimestamp = e.request.header.get('Webhook-Timestamp')
  const webhookSignature = e.request.header.get('Webhook-Signature')

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    throw new BadRequestError('Missing webhook signature headers.')
  }

  // Reject stale deliveries/replays outside a 5 minute window.
  const timestampSeconds = parseInt(webhookTimestamp, 10)
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > 300) {
    throw new BadRequestError('Webhook timestamp outside tolerance.')
  }

  // note: after this call the raw body can't be read again.
  const rawBody = readerToString(e.request.body)

  const secretB64 = secretEnv.startsWith('whsec_') ? secretEnv.slice('whsec_'.length) : secretEnv
  const keyBytes = base64Decode(secretB64)
  const signedMessage = webhookId + '.' + webhookTimestamp + '.' + rawBody
  const expectedSignature = base64Encode(hmacSha256(keyBytes, utf8Encode(signedMessage)))

  // Header may carry multiple space-separated "v1,<sig>" candidates.
  const candidates = webhookSignature
    .split(' ')
    .map((part) => (part.indexOf(',') >= 0 ? part.slice(part.indexOf(',') + 1) : part))

  const isValid = candidates.some((candidate) => bytesEqual(base64Decode(candidate), base64Decode(expectedSignature)))
  if (!isValid) {
    console.error('Polar webhook signature mismatch.')
    throw new BadRequestError('Invalid webhook signature.')
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    throw new BadRequestError('Invalid webhook payload.')
  }

  if (payload.type !== 'order.paid') {
    return e.json(200, { ok: true, ignored: payload.type })
  }

  const email = payload.data && payload.data.customer && payload.data.customer.email
  if (!email) {
    console.error('Polar order.paid webhook missing customer email.')
    return e.json(200, { ok: true, ignored: 'no_email' })
  }

  const user = $app.findFirstRecordByFilter('users', 'email = {:email}', { email })
  user.set('entitled', true)
  $app.save(user)

  return e.json(200, { ok: true })
})
