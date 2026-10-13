/// <reference path="../pb_data/types.d.ts" />

// Server-side "Ask Atlas" (see src/components/AskAtlas.tsx / src/lib/ai.ts).
// Requires ANTHROPIC_API_KEY. A deployment with no key set rejects every
// request with a plain "not enabled" error.
//
// Logged-out guests get GUEST_ASK_LIMIT questions per IP per UTC day. The
// count lives in atlas_guest_questions so clearing localStorage does not
// reset it. Signed-in Sky Pass accounts skip the counter. Signed-in accounts
// without Sky Pass are still rejected — the free allowance is for guests
// who have not created an account yet.

const GUEST_ASK_LIMIT = 3
const GUEST_ASK_BURST_MS = 2000

function readPayload(e) {
  const rawBody = readerToString(e.request.body)
  let payload = {}
  try {
    payload = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    throw new BadRequestError('Invalid request payload.')
  }
  const question = String(payload.question || '').trim().slice(0, 500)
  if (!question) throw new BadRequestError('A question is required.')
  const context = String(payload.context || '').slice(0, 2000)
  return { question, context }
}

function clientIp(e) {
  try {
    const ip = e.realIP()
    if (ip) return String(ip)
  } catch {
    // Fall through to the socket address.
  }
  return String((e.request && e.request.remoteAddr) || 'unknown')
}

function consumeGuestQuestion(ip) {
  const salt = $os.getenv('ATLAS_GUEST_ASK_SALT') || 'atlas-guest-ask-v1'
  const ipHash = $security.hs256(salt + '|' + ip, salt)
  const day = new Date().toISOString().slice(0, 10)
  const collection = $app.findCollectionByNameOrId('atlas_guest_questions')

  let record = null
  try {
    record = $app.findFirstRecordByFilter('atlas_guest_questions', 'ip_hash = {:ip} && day = {:day}', {
      ip: ipHash,
      day: day,
    })
  } catch {
    record = new Record(collection)
    record.set('ip_hash', ipHash)
    record.set('day', day)
    record.set('count', 0)
    record.set('last_at', '')
  }

  const lastAt = String(record.get('last_at') || '')
  if (lastAt) {
    const elapsed = Date.now() - new Date(lastAt).getTime()
    if (elapsed >= 0 && elapsed < GUEST_ASK_BURST_MS) {
      throw new TooManyRequestsError('guest_ask_burst')
    }
  }

  const count = Number(record.get('count') || 0)
  if (count >= GUEST_ASK_LIMIT) {
    throw new TooManyRequestsError('guest_ask_limit')
  }

  // Reserve the slot before the metered model call so a burst of retries
  // cannot spend more than the daily allowance. A burst inside the window
  // above is rejected without consuming a question.
  record.set('count', count + 1)
  record.set('last_at', new Date().toISOString())
  $app.save(record)
}

routerAdd('POST', '/atlas/ask', (e) => {
  const apiKey = $os.getenv('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new BadRequestError('Ask Atlas is not enabled on this deployment.')
  }

  const { question, context } = readPayload(e)
  const user = e.auth
  if (user) {
    if (!user.get('entitled')) {
      throw new BadRequestError('Ask Atlas is a Sky Pass feature.')
    }
  } else {
    consumeGuestQuestion(clientIp(e))
  }

  const prompt =
    'You are Atlas, an amateur-astronomy assistant inside a stargazing app. Answer the following question ' +
    "concisely and practically -- a sentence or two for a simple question, a short paragraph at most for a " +
    "more involved one. Don't pad with disclaimers or generic astronomy trivia; answer what was actually asked.\n\n" +
    (context ? 'Context Atlas already knows: ' + context + '\n\n' : '') +
    'Question: ' +
    question

  let res
  try {
    res = $http.send({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (err) {
    console.error('Anthropic ask-atlas request failed: ' + err)
    throw new BadRequestError('Could not reach Atlas right now.')
  }

  if (res.statusCode >= 400) {
    console.error('Anthropic ask-atlas request failed: ' + res.statusCode + ' ' + res.raw)
    throw new BadRequestError('Could not get an answer right now.')
  }

  const body = res.json
  const answer = body && body.content && body.content[0] && body.content[0].text
  if (!answer) {
    throw new BadRequestError('Atlas returned an empty response.')
  }

  return e.json(200, { answer: answer })
})
