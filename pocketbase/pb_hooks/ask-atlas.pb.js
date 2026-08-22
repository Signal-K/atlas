/// <reference path="../pb_data/types.d.ts" />

// Server-side "Ask Atlas" free-text Q&A for Sky Pass users (see
// src/components/AskAtlas.tsx / src/lib/ai.ts). Same pattern as
// eclipse-roadmap.pb.js/photo-caption.pb.js/trip-guide.pb.js: requires
// ANTHROPIC_API_KEY -- built and usable, but deliberately NOT enabled
// anywhere until that secret is actually configured. A deployment with no
// key set rejects every request here with a plain "not enabled" error, same
// as if this file didn't exist.
//
// This replaces the previous client call to a non-existent `/ai/ask` route
// (a stale reference to a Go backend/main.go handler that was never part of
// this repo) -- ai.ts now calls this endpoint instead.
routerAdd(
  'POST',
  '/atlas/ask',
  (e) => {
    const apiKey = $os.getenv('ANTHROPIC_API_KEY')
    if (!apiKey) {
      throw new BadRequestError('Ask Atlas is not enabled on this deployment.')
    }

    const user = e.auth
    if (!user.get('entitled')) {
      throw new BadRequestError('Ask Atlas is a Sky Pass feature.')
    }

    const rawBody = readerToString(e.request.body)
    let payload = {}
    try {
      payload = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      throw new BadRequestError('Invalid request payload.')
    }

    const question = String(payload.question || '').trim().slice(0, 500)
    if (!question) {
      throw new BadRequestError('A question is required.')
    }
    const context = String(payload.context || '').slice(0, 2000)

    // Grounds the model in whatever Atlas already knows about the screen the
    // question was asked from (an event, tonight's conditions, etc.), same
    // division of labor as eclipse-roadmap.pb.js and trip-guide.pb.js --
    // the client sends what it already computed, Claude only writes prose.
    const prompt =
      'You are Atlas, an amateur-astronomy assistant inside a stargazing app. Answer the following question ' +
      "concisely and practically -- a sentence or two for a simple question, a short paragraph at most for a " +
      "more involved one. Don't pad with disclaimers or generic astronomy trivia; answer what was actually asked.\n\n" +
      (context ? `Context Atlas already knows: ${context}\n\n` : '') +
      `Question: ${question}`

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

    return e.json(200, { answer })
  },
  $apis.requireAuth(),
)
