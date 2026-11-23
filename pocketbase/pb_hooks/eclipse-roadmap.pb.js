/// <reference path="../pb_data/types.d.ts" />

// Server-side "personalized eclipse viewing plan" for Sky Pass users (see
// the eclipse timeline in src/lib/eventGuide.ts / EntryDetailView.tsx).
// Same pattern as photo-caption.pb.js: requires an AI provider key (see ai-provider.js) -- built
// and usable, but deliberately NOT enabled anywhere until that secret is
// actually configured. A deployment with no key set rejects every request
// here with a plain "not enabled" error, same as if this file didn't exist.
routerAdd(
  'POST',
  '/atlas/events/eclipse-roadmap',
  (e) => {
    const ai = require(`${__hooks}/ai-provider.js`)
    if (!ai.enabled()) {
      throw new BadRequestError('Eclipse viewing plans are not enabled on this deployment.')
    }

    const user = e.auth
    if (!user.get('entitled')) {
      throw new BadRequestError('Eclipse viewing plans are a Sky Pass feature.')
    }

    const rawBody = readerToString(e.request.body)
    let payload = {}
    try {
      payload = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      throw new BadRequestError('Invalid request payload.')
    }

    const title = String(payload.title || 'this eclipse').slice(0, 200)
    const locationName = String(payload.locationName || 'your location').slice(0, 200)
    const timeZone = String(payload.timeZone || '').slice(0, 100)
    const lat = Number(payload.lat)
    const lon = Number(payload.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new BadRequestError('A location is required.')
    }

    const guideSteps = Array.isArray(payload.guideSteps) ? payload.guideSteps.slice(0, 12) : []
    const timeline = guideSteps
      .map((step) => `- ${String((step && step.label) || '').slice(0, 100)}: ${String((step && step.detail) || '').slice(0, 300)}`)
      .join('\n')

    // Grounds the model in what Atlas already computed for this observer
    // (the same local eclipse circumstances shown in the app's timeline)
    // instead of asking it to guess generic eclipse advice.
    const prompt =
      `Build a short, practical, step-by-step viewing plan for an amateur astronomer watching ${title} from ` +
      `${locationName} (latitude ${lat.toFixed(2)}, longitude ${lon.toFixed(2)}${timeZone ? `, time zone ${timeZone}` : ''}).\n\n` +
      `Known local timeline:\n${timeline || '(local circumstances unavailable -- give general guidance instead)'}\n\n` +
      'Write it as a numbered checklist covering: what to bring (eclipse glasses or a solar filter, camera gear if ' +
      'relevant), when to arrive and where to stand for a clear view toward the Sun, what to actually do at each ' +
      'phase from the timeline above, and one safety reminder about never looking at the Sun unfiltered outside of ' +
      "totality. Keep it under 250 words, concrete and actionable -- not generic astronomy trivia."

    const roadmap = ai.generate({
      label: 'roadmap',
      maxTokens: 600,
      prompt,
    })

    return e.json(200, { roadmap })
  },
  $apis.requireAuth(),
)
