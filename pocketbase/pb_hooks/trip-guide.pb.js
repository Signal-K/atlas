/// <reference path="../pb_data/types.d.ts" />

// Server-side "personalized trip guide" for Sky Pass trip planning (see
// src/lib/tripPlans.ts / src/lib/tripGuide.ts). Same pattern as
// eclipse-roadmap.pb.js and photo-caption.pb.js: requires ANTHROPIC_API_KEY
// -- built and usable, but deliberately NOT enabled anywhere until that
// secret is actually configured. A deployment with no key set rejects every
// request here with a plain "not enabled" error, same as if this file
// didn't exist.
//
// The client computes and sends the astronomy signals (Bortle class, moon
// illumination, a deterministic Milky-Way-visibility verdict, weather,
// nearby darker sites, interest-filtered highlights) rather than this hook
// re-deriving them -- Claude only writes the narrative around numbers Atlas
// already trusts, the same division of labor eclipse-roadmap.pb.js uses for
// its local eclipse timeline.
routerAdd(
  'POST',
  '/atlas/trips/guide',
  (e) => {
    const apiKey = $os.getenv('ANTHROPIC_API_KEY')
    if (!apiKey) {
      throw new BadRequestError('Trip guides are not enabled on this deployment.')
    }

    const user = e.auth
    if (!user.get('entitled')) {
      throw new BadRequestError('Trip guides are a Sky Pass feature.')
    }

    const rawBody = readerToString(e.request.body)
    let payload = {}
    try {
      payload = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      throw new BadRequestError('Invalid request payload.')
    }

    const cityName = String(payload.cityName || 'this location').slice(0, 200)
    const startDate = String(payload.startDate || '').slice(0, 10)
    const endDate = String(payload.endDate || '').slice(0, 10)
    const bortleClass = Number(payload.bortleClass)
    const skyQualityLabel = String(payload.skyQualityLabel || '').slice(0, 60)
    const moonIlluminationPct = Number(payload.moonIlluminationPct)
    const milkyWayVisible = ['yes', 'marginal', 'no'].includes(payload.milkyWayVisible) ? payload.milkyWayVisible : 'no'
    const cloudCoverPct = Number.isFinite(Number(payload.cloudCoverPct)) ? Number(payload.cloudCoverPct) : null
    if (!Number.isFinite(bortleClass) || !Number.isFinite(moonIlluminationPct)) {
      throw new BadRequestError('Sky-condition signals are required.')
    }

    const equipment = Array.isArray(payload.equipment) ? payload.equipment.slice(0, 10).map((v) => String(v).slice(0, 40)) : []
    const interests = Array.isArray(payload.interests) ? payload.interests.slice(0, 10).map((v) => String(v).slice(0, 40)) : []
    const highlights = Array.isArray(payload.highlights) ? payload.highlights.slice(0, 10) : []
    const nearbyDarkSites = Array.isArray(payload.nearbyDarkSites) ? payload.nearbyDarkSites.slice(0, 5) : []

    const highlightsLines = highlights
      .map((h) => `- ${String((h && h.title) || '').slice(0, 120)} (${String((h && h.kind) || '').slice(0, 40)}, ${String((h && h.date) || '').slice(0, 20)})`)
      .join('\n')
    const darkSiteLines = nearbyDarkSites
      .map((s) => `- ${String((s && s.name) || '').slice(0, 120)}, Bortle ${Number((s && s.bortleClass) || 0)}, ~${Number((s && s.distanceKm) || 0).toFixed(0)}km away`)
      .join('\n')

    // Grounds the model in what Atlas already computed for this leg instead
    // of asking it to guess generic astro-tourism advice.
    const prompt =
      `Write a short, practical sky-watching guide for a trip to ${cityName} from ${startDate} to ${endDate}.\n\n` +
      `Known conditions:\n` +
      `- Light pollution: Bortle class ${bortleClass} (${skyQualityLabel || 'unrated'})\n` +
      `- Moon illumination: ${Math.round(moonIlluminationPct)}%\n` +
      `- Milky Way visibility verdict (already decided, do not contradict it): ${milkyWayVisible}\n` +
      (cloudCoverPct != null ? `- Typical cloud cover: ${Math.round(cloudCoverPct)}%\n` : '') +
      (equipment.length ? `- Equipment on hand: ${equipment.join(', ')}\n` : '- Equipment on hand: naked eye only\n') +
      (interests.length ? `- Traveler's interests: ${interests.join(', ')}\n` : '') +
      (highlightsLines ? `\nNotable events during the stay:\n${highlightsLines}\n` : '\nNo major scheduled sky events during the stay.\n') +
      (darkSiteLines ? `\nNearby darker-sky sites worth a short trip:\n${darkSiteLines}\n` : '') +
      '\nExplicitly state whether the Milky Way will be visible (matching the verdict above) and name any other ' +
      "standout sights given the equipment on hand and interests. Be concrete and specific to this city and these " +
      'dates, not generic astronomy trivia. Keep it under 200 words.'

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
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    } catch (err) {
      console.error('Anthropic trip-guide request failed: ' + err)
      throw new BadRequestError('Could not reach the planning service.')
    }

    if (res.statusCode >= 400) {
      console.error('Anthropic trip-guide request failed: ' + res.statusCode + ' ' + res.raw)
      throw new BadRequestError('Could not generate a trip guide.')
    }

    const body = res.json
    const narrative = body && body.content && body.content[0] && body.content[0].text
    if (!narrative) {
      throw new BadRequestError('Planning service returned an empty response.')
    }

    return e.json(200, { narrative })
  },
  $apis.requireAuth(),
)
