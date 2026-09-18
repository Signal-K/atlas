// Geometry for drawing a moon phase as an SVG path.
//
// The previous implementation drew the shadow as a full-radius circle shifted
// sideways and clipped to the disc. Two circles of equal radius only make a
// crescent when their centres are far apart, so that produced a solid black
// disc at half phase, a half-lit disc at new moon, and a half-dark disc at
// full moon -- wrong at every illumination rather than just at the one a
// reviewer happened to catch.
//
// The real terminator is the projection of a circle seen edge-on: an ellipse
// sharing the disc's vertical radius, whose horizontal semi-axis shrinks to
// zero at half phase and grows back to the full radius at new and full.
//
//   rx = r * |1 - 2k|     for k = illuminated fraction
//
// So the lit region is bounded by a semicircular limb on one side and half of
// that ellipse on the other. Which side the limb sits on depends on whether
// the Moon is waxing or waning, and flips again south of the equator, where
// observers see the disc effectively upside down.

function clamp01(value) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

/**
 * SVG path for the *lit* portion of the disc. Callers draw an unlit disc
 * underneath and paint this on top, so new moon (an empty path) and full moon
 * (the whole disc) both fall out of the same code path without special cases.
 *
 * @param {object} options
 * @param {number} options.cx Disc centre x
 * @param {number} options.cy Disc centre y
 * @param {number} options.r Disc radius
 * @param {number} options.illuminatedFraction 0 (new) .. 1 (full)
 * @param {boolean} [options.waxing] True between new and full
 * @param {boolean} [options.southernHemisphere] Mirrors the lit limb
 * @returns {string} An SVG path `d` attribute
 */
export function moonLitPath({ cx, cy, r, illuminatedFraction, waxing = true, southernHemisphere = false }) {
  const k = clamp01(illuminatedFraction)
  const rx = r * Math.abs(1 - 2 * k)

  // A waxing moon is lit on its western limb, which a northern-hemisphere
  // observer sees on the right. Waning flips it; so does crossing the equator.
  const litOnRight = waxing !== southernHemisphere

  const top = `${cx} ${cy - r}`
  const bottom = `${cx} ${cy + r}`

  // SVG's y axis points down, so sweep 1 from top to bottom traces the right
  // half of the circle and sweep 0 traces the left half.
  const limbSweep = litOnRight ? 1 : 0

  // Returning along the terminator, the arc runs bottom-to-top, which inverts
  // the meaning of the sweep flag. A gibbous phase bulges past the centre line
  // away from the lit limb; a crescent curves back toward it.
  const terminatorSweep = k > 0.5 ? limbSweep : 1 - limbSweep

  return `M ${top} A ${r} ${r} 0 0 ${limbSweep} ${bottom} A ${rx} ${r} 0 0 ${terminatorSweep} ${top} Z`
}

/**
 * Fraction of the disc's area the path above encloses. The half-disc plus or
 * minus the half-ellipse works out to exactly the illuminated fraction, which
 * is what makes the geometry above the correct one.
 */
export function litAreaFraction(illuminatedFraction) {
  const k = clamp01(illuminatedFraction)
  const halfEllipse = Math.abs(1 - 2 * k) / 2
  return k > 0.5 ? 0.5 + halfEllipse : 0.5 - halfEllipse
}
