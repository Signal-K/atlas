/// <reference path="../pb_data/types.d.ts" />

// Server-side "AI photo caption" for Sky Pass observations (see
// outbox/story-ai-photo-captions.md). Requires ANTHROPIC_API_KEY -- same
// pattern as the atlas repo's DONKI solar-flare source: built and usable,
// but deliberately NOT enabled anywhere until that secret is actually
// configured. A deployment with no key set rejects every request here with
// a plain "not enabled" error, same as if this file didn't exist.
//
// The client sends the photo as base64 in the JSON body rather than a
// multipart file upload, so this only needs the same
// readerToString(e.request.body) + JSON.parse pattern already used by
// demo-access.pb.js/polar.pb.js -- no separate multipart-file JSVM API to
// get right, and no need to fetch the already-uploaded PocketBase file back
// out (the client already has the bytes in memory right after picking the
// photo, before it even uploads to atlas_observations).
routerAdd(
  'POST',
  '/atlas/observations/caption',
  (e) => {
    const apiKey = $os.getenv('ANTHROPIC_API_KEY')
    if (!apiKey) {
      throw new BadRequestError('AI photo captions are not enabled on this deployment.')
    }

    const user = e.auth
    if (!user.get('entitled')) {
      throw new BadRequestError('AI photo captions are a Sky Pass feature.')
    }

    const rawBody = readerToString(e.request.body)
    let payload = {}
    try {
      payload = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      throw new BadRequestError('Invalid caption payload.')
    }

    const photoBase64 = String(payload.photoBase64 || '')
    const mimeType = String(payload.mimeType || 'image/jpeg')
    if (!photoBase64) {
      throw new BadRequestError('photoBase64 is required.')
    }
    // Keep the request small and bound cost/latency -- generous ceiling for
    // a phone photo re-encoded at reasonable quality, well under Claude's
    // own 10MB (base64) per-image limit.
    if (photoBase64.length > 8_000_000) {
      throw new BadRequestError('Photo is too large.')
    }

    const targetName = String(payload.targetName || '').slice(0, 200)
    const conditionSummary = String(payload.conditionSummary || '').slice(0, 300)

    // Grounds the model in what Atlas already knows (target, conditions)
    // instead of asking it to guess blind -- a phone photo alone often
    // can't disambiguate "faint dot" from "which planet," but combined
    // with what the observer was aiming at and the weather/moon at the
    // time, a much more confident and specific caption is possible.
    const contextLine = [
      targetName ? `The observer was aiming at: ${targetName}.` : '',
      conditionSummary ? `Conditions at the time: ${conditionSummary}.` : '',
    ]
      .filter(Boolean)
      .join(' ')

    const prompt =
      `This is a phone photo taken by an amateur astronomer using the Atlas app. ${contextLine} ` +
      'In one or two short sentences, describe what is actually visible in the photo (not just what was aimed at) -- ' +
      'name any recognizable object if you can see one clearly, and be honest if the photo is too dark, blurry, or ' +
      "overexposed to tell. Don't be effusive -- write like a field log entry, not marketing copy."

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
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mimeType, data: photoBase64 } },
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
      })
    } catch (err) {
      console.error('Anthropic vision request failed: ' + err)
      throw new BadRequestError('Could not reach the captioning service.')
    }

    if (res.statusCode >= 400) {
      console.error('Anthropic vision request failed: ' + res.statusCode + ' ' + res.raw)
      throw new BadRequestError('Could not generate a caption.')
    }

    const body = res.json
    const caption = body && body.content && body.content[0] && body.content[0].text
    if (!caption) {
      throw new BadRequestError('Captioning service returned an empty response.')
    }

    // Best-effort persistence -- the caption is still returned to the
    // client (and shown immediately) even if this save fails or the
    // observation record doesn't belong to this user.
    const observationId = String(payload.observationId || '')
    if (observationId) {
      try {
        const observation = $app.findRecordById('atlas_observations', observationId)
        if (observation.get('user') === user.id) {
          observation.set('ai_caption', caption)
          $app.save(observation)
        }
      } catch {
        // Observation not found, or save failed -- not fatal to the request.
      }
    }

    return e.json(200, { caption })
  },
  $apis.requireAuth(),
)
