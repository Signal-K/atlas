#!/usr/bin/env node
// Generates src/data/messierCatalog.ts, the full 110-slot Messier catalog
// (109 real objects; M102 is the traditionally disputed/duplicate slot and
// has no independent entry in any source used here, matching convention --
// see e.g. HEASARC's Messier catalog, which carries the same note).
//
// Source: OpenNGC (github.com/mattiaverga/OpenNGC, CC-BY-SA-4.0), which
// tags Messier numbers on its NGC/IC rows via an "M" column. Most Messier
// objects (107 of 109) appear in OpenNGC's main NGC.csv; two -- M40 (a
// double star, never catalogued in the NGC) and M45 / the Pleiades (usually
// catalogued as a Collinder object, not NGC) -- only appear in OpenNGC's own
// addendum.csv, which exists specifically to cover that gap. Both are
// fetched and merged, addendum only filling M numbers NGC.csv doesn't have.
//
// Network path:
//   node scripts/generate-messier-catalog.mjs
// Local CSV path (both files required together):
//   node scripts/generate-messier-catalog.mjs --input path/to/NGC.csv --addendum path/to/addendum.csv

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parseRaHours, parseDecDeg } from './lib/sexagesimal.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = path.join(ROOT, 'src/data/messierCatalog.ts')

const NGC_URL = 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv'
const ADDENDUM_URL = 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/addendum.csv'

// Same 12 objects the hand-written DEEP_SKY_TARGETS list already had, used
// as the no-network fallback so a failed fetch still produces a working
// (if smaller) catalog rather than an empty one.
const FALLBACK_OBJECTS = [
  ['m31', 'Andromeda Galaxy', 'galaxy', 0.712, 41.269, 3.4, 3.1],
  ['m42', 'Orion Nebula', 'nebula', 5.588, -5.391, 4.0, 1.1],
  ['m45', 'Pleiades', 'open cluster', 3.792, 24.117, 1.6, 1.8],
  ['m44', 'Beehive Cluster', 'open cluster', 8.672, 19.672, 3.7, 1.6],
  ['m8', 'Lagoon Nebula', 'nebula', 18.061, -24.386, 6.0, 1.5],
  ['m20', 'Trifid Nebula', 'nebula', 18.041, -23.029, 6.3, 0.5],
  ['m57', 'Ring Nebula', 'planetary nebula', 18.894, 33.029, 8.8, 0.025],
  ['m27', 'Dumbbell Nebula', 'planetary nebula', 19.993, 22.721, 7.4, 0.13],
  ['m13', 'Hercules Cluster', 'globular cluster', 16.695, 36.467, 5.8, 0.33],
  ['ngc3372', 'Carina Nebula', 'nebula', 10.752, -59.867, 1.0, 2.0],
  ['ngc7000', 'North America Nebula', 'nebula', 20.974, 44.333, 4.0, 2.0],
  ['omega-centauri', 'Omega Centauri', 'globular cluster', 13.447, -47.48, 3.9, 0.6],
]

// OpenNGC's single/short Type codes -> the free-form strings this app
// already uses elsewhere for deep-sky object type (see the original
// DEEP_SKY_TARGETS: 'galaxy', 'nebula', 'open cluster', etc.).
const TYPE_LABELS = {
  G: 'galaxy',
  GCl: 'globular cluster',
  OCl: 'open cluster',
  Neb: 'nebula',
  HII: 'nebula',
  PN: 'planetary nebula',
  SNR: 'supernova remnant',
  'Cl+N': 'cluster + nebula',
  '*Ass': 'star association',
  RfN: 'reflection nebula',
  '**': 'double star',
  Other: 'deep sky object',
}

// A handful of Messier objects (mostly small planetary nebulae or compact
// asterisms) carry no MajAx in OpenNGC at all. Falling back to a small but
// non-zero size keeps every object usable as a real, framable target rather
// than crashing or silently dropping it from the catalog.
const DEFAULT_ANGULAR_SIZE_DEG = 0.05

function parseNumber(value) {
  const raw = String(value ?? '').trim()
  // Number('') is 0, not NaN -- a blank CSV cell (M40's MajAx, for example)
  // would otherwise silently become a real angular size of zero degrees
  // instead of falling through to DEFAULT_ANGULAR_SIZE_DEG below.
  if (raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

// OpenNGC is semicolon-delimited, unlike the Bright Star script's VizieR
// TSV -- a plain split is fine here since none of the fields this script
// reads contain embedded semicolons.
function parseCsv(text) {
  const lines = text.split('\n').map((line) => line.trimEnd()).filter(Boolean)
  const headers = lines[0].split(';')
  return lines.slice(1).map((line) => {
    const cells = line.split(';')
    return Object.fromEntries(headers.map((header, i) => [header, cells[i]?.trim() ?? '']))
  })
}

function firstCommonName(record) {
  const raw = record['Common names']
  if (!raw) return null
  return raw.split(',')[0]?.trim() || null
}

// Builds one catalog entry from an OpenNGC row already known to carry a
// Messier number, or returns null if the row is missing data this catalog
// requires (no valid position -- everything else has a sane fallback).
function catalogEntryFromRow(record) {
  const mNumber = Number(record.M)
  if (!Number.isFinite(mNumber) || mNumber <= 0) return null
  const raHours = parseRaHours(record.RA)
  const decDeg = parseDecDeg(record.Dec)
  if (raHours == null || decDeg == null) return null
  const magnitude = parseNumber(record['V-Mag']) ?? parseNumber(record['B-Mag'])
  const majAxArcmin = parseNumber(record.MajAx)
  return {
    mNumber,
    id: `m${mNumber}`,
    name: firstCommonName(record) ?? `M${mNumber}`,
    type: TYPE_LABELS[record.Type] ?? 'deep sky object',
    raHours: Number(raHours.toFixed(5)),
    decDeg: Number(decDeg.toFixed(5)),
    // A handful of Messier objects have no measured V/B magnitude in
    // OpenNGC (observed: M101's addendum duplicate only -- the real M101
    // row in NGC.csv has one, so this path is effectively unreached for
    // the merged catalog, but kept as a safety net over a hypothetical
    // future source gap rather than producing NaN).
    magnitude: magnitude ?? 99,
    angularSizeDeg: majAxArcmin != null ? Number((majAxArcmin / 60).toFixed(4)) : DEFAULT_ANGULAR_SIZE_DEG,
  }
}

function parseMessierRows(ngcText, addendumText) {
  const byNumber = new Map()
  for (const record of parseCsv(ngcText)) {
    const entry = catalogEntryFromRow(record)
    if (entry) byNumber.set(entry.mNumber, entry)
  }
  // Addendum only fills gaps NGC.csv doesn't cover (M40, M45) -- it also
  // carries a duplicate M101 row with no usable data, which byNumber.has()
  // below correctly skips in favor of the real one already set above.
  for (const record of parseCsv(addendumText)) {
    const entry = catalogEntryFromRow(record)
    if (entry && !byNumber.has(entry.mNumber)) byNumber.set(entry.mNumber, entry)
  }
  return [...byNumber.values()].sort((a, b) => a.mNumber - b.mNumber)
}

function fallbackCatalog() {
  return FALLBACK_OBJECTS.map(([id, name, type, raHours, decDeg, magnitude, angularSizeDeg]) => ({
    id,
    name,
    type,
    raHours,
    decDeg,
    magnitude,
    angularSizeDeg,
  }))
}

function renderCatalog(objects, sourceLabel) {
  const rows = objects
    .map(
      (object) =>
        `  { id: ${JSON.stringify(object.id)}, name: ${JSON.stringify(object.name)}, type: ${JSON.stringify(object.type)}, raHours: ${object.raHours}, decDeg: ${object.decDeg}, magnitude: ${object.magnitude}, angularSizeDeg: ${object.angularSizeDeg} },`,
    )
    .join('\n')
  return `export interface MessierObject {
  id: string
  name: string
  type: string
  raHours: number
  decDeg: number
  magnitude: number
  angularSizeDeg: number
}

// Generated by scripts/generate-messier-catalog.mjs.
// Source: ${sourceLabel}
export const MESSIER_OBJECTS: MessierObject[] = [
${rows}
]
`
}

async function loadSource() {
  const inputIndex = process.argv.indexOf('--input')
  const addendumIndex = process.argv.indexOf('--addendum')
  if (inputIndex >= 0) {
    const inputPath = process.argv[inputIndex + 1]
    const addendumPath = addendumIndex >= 0 ? process.argv[addendumIndex + 1] : null
    if (!inputPath || !addendumPath) throw new Error('--input requires both --input and --addendum file paths')
    return {
      ngcText: await readFile(inputPath, 'utf8'),
      addendumText: await readFile(addendumPath, 'utf8'),
      source: `${inputPath}, ${addendumPath}`,
    }
  }

  try {
    const [ngcResponse, addendumResponse] = await Promise.all([fetch(NGC_URL), fetch(ADDENDUM_URL)])
    if (!ngcResponse.ok) throw new Error(`${ngcResponse.status} ${ngcResponse.statusText} (NGC.csv)`)
    if (!addendumResponse.ok) throw new Error(`${addendumResponse.status} ${addendumResponse.statusText} (addendum.csv)`)
    return {
      ngcText: await ngcResponse.text(),
      addendumText: await addendumResponse.text(),
      source: `${NGC_URL}, ${ADDENDUM_URL}`,
    }
  } catch (error) {
    console.warn(`Could not fetch OpenNGC catalog; using fallback seed. ${error.message}`)
    return { ngcText: null, addendumText: null, source: 'fallback seed list' }
  }
}

async function main() {
  const { ngcText, addendumText, source } = await loadSource()
  const objects = ngcText ? parseMessierRows(ngcText, addendumText) : fallbackCatalog()
  if (objects.length === 0) throw new Error('Generated catalog is empty')
  await writeFile(OUT_FILE, renderCatalog(objects, source))
  console.log(`Wrote ${objects.length} Messier objects to ${path.relative(ROOT, OUT_FILE)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
