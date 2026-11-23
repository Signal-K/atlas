// Shared text/vision generation for the Sky Pass AI hooks (eclipse-roadmap,
// trip-guide, photo-caption). Not a *.pb.js file on purpose: PocketBase only
// auto-loads *.pb.js as hooks, so this is pulled in with
//   const ai = require(`${__hooks}/ai-provider.js`)
// inside each handler (handlers run in isolated contexts; top-level
// requires are not visible to them).
//
// Provider selection:
//   AI_PROVIDER=gemini|anthropic  explicit choice
//   (unset)                       gemini if GEMINI_API_KEY is set, else
//                                 anthropic if ANTHROPIC_API_KEY is set
// With no usable key, enabled() is false and every hook answers with its
// plain "not enabled" error.

function provider() {
  const explicit = String($os.getenv('AI_PROVIDER') || '').toLowerCase()
  const hasGemini = !!$os.getenv('GEMINI_API_KEY')
  const hasAnthropic = !!$os.getenv('ANTHROPIC_API_KEY')
  if (explicit === 'gemini') return hasGemini ? 'gemini' : ''
  if (explicit === 'anthropic') return hasAnthropic ? 'anthropic' : ''
  if (hasGemini) return 'gemini'
  if (hasAnthropic) return 'anthropic'
  return ''
}

function enabled() {
  return provider() !== ''
}

function geminiModel() {
  return $os.getenv('GEMINI_MODEL') || 'gemini-2.5-flash-lite'
}

function callGemini(opts) {
  const model = geminiModel()
  const parts = []
  if (opts.imageBase64) {
    parts.push({ inline_data: { mime_type: opts.mimeType || 'image/jpeg', data: opts.imageBase64 } })
  }
  parts.push({ text: opts.prompt })

  const generationConfig = { maxOutputTokens: opts.maxTokens }
  // 2.5-series models spend output tokens on hidden "thinking" by default,
  // which truncates short answers. These tasks do not need it.
  if (model.indexOf('2.5') !== -1) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 }
  }

  const res = $http.send({
    url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
    method: 'POST',
    headers: {
      'x-goog-api-key': $os.getenv('GEMINI_API_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contents: [{ role: 'user', parts: parts }], generationConfig: generationConfig }),
    timeout: 60,
  })

  let text = ''
  const body = res.json
  const candidate = body && body.candidates && body.candidates[0]
  const outParts = (candidate && candidate.content && candidate.content.parts) || []
  for (let i = 0; i < outParts.length; i++) {
    if (outParts[i] && outParts[i].text) text += outParts[i].text
  }
  return { status: res.statusCode, raw: res.raw, text: text.trim() }
}

function callAnthropic(opts) {
  const content = opts.imageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: opts.mimeType || 'image/jpeg', data: opts.imageBase64 } },
        { type: 'text', text: opts.prompt },
      ]
    : opts.prompt

  const res = $http.send({
    url: 'https://api.anthropic.com/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': $os.getenv('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: opts.maxTokens,
      messages: [{ role: 'user', content: content }],
    }),
    timeout: 60,
  })

  const body = res.json
  const text = (body && body.content && body.content[0] && body.content[0].text) || ''
  return { status: res.statusCode, raw: res.raw, text: String(text).trim() }
}

// opts: { prompt, maxTokens, imageBase64?, mimeType?, label }
// Returns the generated text. Throws BadRequestError with a user-safe
// message on any failure; details go to the server log only.
function generate(opts) {
  const name = provider()
  if (!name) throw new BadRequestError('AI features are not enabled on this deployment.')

  let result
  try {
    result = name === 'gemini' ? callGemini(opts) : callAnthropic(opts)
  } catch (err) {
    console.error(name + ' ' + opts.label + ' request failed: ' + err)
    throw new BadRequestError('Could not reach the AI service right now.')
  }

  if (result.status === 429) {
    console.error(name + ' ' + opts.label + ' rate limited: ' + result.raw)
    throw new BadRequestError('The AI service is busy right now. Try again later.')
  }
  if (result.status >= 400) {
    console.error(name + ' ' + opts.label + ' request failed: ' + result.status + ' ' + result.raw)
    throw new BadRequestError('The AI service could not complete that request.')
  }
  if (!result.text) {
    throw new BadRequestError('The AI service returned an empty response.')
  }
  return result.text
}

module.exports = { enabled: enabled, generate: generate, provider: provider }
