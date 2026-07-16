#!/usr/bin/env node
// Generates src/data/brightStars.ts from the VizieR Bright Star Catalogue.
// Network path:
//   npm run stars
// Local TSV path:
//   node scripts/generate-bright-stars.mjs --input path/to/catalog.tsv

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = path.join(ROOT, 'src/data/brightStars.ts')
const MAX_MAG = Number(process.env.STAR_MAG_LIMIT ?? 6.5)

const VIZIER_URL =
  'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?' +
  new URLSearchParams({
    '-source': 'V/50/catalog',
    '-out.max': '10000',
    '-out': 'HR,Name,RAJ2000,DEJ2000,Vmag,B-V',
    Vmag: `..${MAX_MAG}`,
  }).toString()

const FALLBACK_STARS = [
  ['sirius', 'Sirius', 6.7525, -16.7161, -1.46, 0],
  ['canopus', 'Canopus', 6.3992, -52.6957, -0.74, 0.15],
  ['rigil-kentaurus', 'Rigil Kentaurus', 14.6601, -60.8356, -0.27, 0.71],
  ['arcturus', 'Arcturus', 14.261, 19.1825, -0.05, 1.23],
  ['vega', 'Vega', 18.6156, 38.7837, 0.03, 0],
  ['capella', 'Capella', 5.2782, 45.998, 0.08, 0.8],
  ['rigel', 'Rigel', 5.2423, -8.2016, 0.13, -0.03],
  ['procyon', 'Procyon', 7.655, 5.225, 0.34, 0.42],
  ['achernar', 'Achernar', 1.6286, -57.2368, 0.46, -0.16],
  ['betelgeuse', 'Betelgeuse', 5.9195, 7.4071, 0.5, 1.85],
  ['hadar', 'Hadar', 14.0637, -60.373, 0.61, -0.23],
  ['altair', 'Altair', 19.8464, 8.8683, 0.76, 0.22],
  ['acrux', 'Acrux', 12.4433, -63.0991, 0.76, -0.24],
  ['aldebaran', 'Aldebaran', 4.5987, 16.5093, 0.85, 1.54],
  ['spica', 'Spica', 13.4199, -11.1613, 0.98, -0.23],
  ['antares', 'Antares', 16.4901, -26.432, 1.06, 1.83],
  ['pollux', 'Pollux', 7.7553, 28.0262, 1.14, 1],
  ['fomalhaut', 'Fomalhaut', 22.9608, -29.6222, 1.16, 0.09],
  ['deneb', 'Deneb', 20.6905, 45.2803, 1.25, 0.09],
  ['regulus', 'Regulus', 10.1395, 11.9672, 1.35, -0.11],
  ['adhara', 'Adhara', 6.9771, -28.9721, 1.5, -0.21],
  ['castor', 'Castor', 7.5767, 31.8883, 1.58, 0.03],
  ['gacrux', 'Gacrux', 12.5194, -57.1132, 1.63, 1.59],
  ['bellatrix', 'Bellatrix', 5.4189, 6.3497, 1.64, -0.22],
  ['elnath', 'Elnath', 5.4382, 28.6075, 1.65, -0.13],
  ['miaplacidus', 'Miaplacidus', 9.22, -69.7172, 1.67, 0.02],
  ['alnilam', 'Alnilam', 5.6036, -1.2019, 1.69, -0.18],
  ['alnair', 'Alnair', 22.1372, -46.9609, 1.73, -0.07],
  ['alioth', 'Alioth', 12.9005, 55.9598, 1.76, -0.02],
  ['dubhe', 'Dubhe', 11.0621, 61.751, 1.79, 1.06],
  ['mirfak', 'Mirfak', 3.4054, 49.8612, 1.79, 0.48],
  ['kaus-australis', 'Kaus Australis', 18.4029, -34.3846, 1.85, -0.03],
  ['alkaid', 'Alkaid', 13.7923, 49.3133, 1.85, -0.19],
  ['avior', 'Avior', 8.3752, -59.5095, 1.86, 1.2],
  ['sargas', 'Sargas', 17.6219, -42.9978, 1.86, 0.41],
  ['menkalinan', 'Menkalinan', 5.9921, 44.9474, 1.9, 0],
]

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseSexagesimal(value, scale) {
  if (!value) return null
  const parts = value.trim().replace(/[+:]/g, ' ').split(/\s+/).map(Number)
  if (parts.some((part) => Number.isNaN(part))) return null
  const sign = value.trim().startsWith('-') ? -1 : 1
  const abs = Math.abs(parts[0]) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600
  return sign * abs * scale
}

function parseRaHours(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const sexagesimal = /[:\s]/.test(raw) ? parseSexagesimal(raw, 1) : null
  if (sexagesimal != null) return sexagesimal > 24 ? sexagesimal / 15 : sexagesimal
  const decimal = Number(raw)
  if (!Number.isFinite(decimal)) return null
  return decimal > 24 ? decimal / 15 : decimal
}

function parseDecDeg(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const sexagesimal = /[:\s]/.test(raw) ? parseSexagesimal(raw, 1) : null
  if (sexagesimal != null) return sexagesimal
  const decimal = Number(raw)
  return Number.isFinite(decimal) ? decimal : null
}

function parseNumber(value) {
  const n = Number(String(value ?? '').trim())
  return Number.isFinite(n) ? n : undefined
}

function parseTsv(text) {
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('-'))
  const headerIndex = rows.findIndex((line) => /RAJ2000|DEJ2000|Vmag/.test(line))
  if (headerIndex < 0) throw new Error('Could not find VizieR TSV header')
  const headers = rows[headerIndex].split('\t').map((header) => header.trim())
  const dataRows = rows.slice(headerIndex + 1)

  return dataRows
    .map((line, index) => {
      const cells = line.split('\t')
      const record = Object.fromEntries(headers.map((header, i) => [header, cells[i]?.trim() ?? '']))
      const rawName = record.Name || `HR ${record.HR || index + 1}`
      const raHours = parseRaHours(record.RAJ2000)
      const decDeg = parseDecDeg(record.DEJ2000)
      const magnitude = parseNumber(record.Vmag)
      if (raHours == null || decDeg == null || magnitude == null || magnitude > MAX_MAG) return null
      return {
        id: slugify(rawName || `hr-${record.HR || index + 1}`),
        name: rawName.trim(),
        raHours: Number(raHours.toFixed(5)),
        decDeg: Number(decDeg.toFixed(5)),
        magnitude: Number(magnitude.toFixed(2)),
        colorIndex: parseNumber(record['B-V']),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.magnitude - b.magnitude)
}

function fallbackCatalog() {
  return FALLBACK_STARS.map(([id, name, raHours, decDeg, magnitude, colorIndex]) => ({
    id,
    name,
    raHours,
    decDeg,
    magnitude,
    colorIndex,
  }))
}

function renderCatalog(stars, sourceLabel) {
  const rows = stars
    .map((star) => {
      const color = star.colorIndex == null ? '' : `, colorIndex: ${star.colorIndex}`
      return `  { id: ${JSON.stringify(star.id)}, name: ${JSON.stringify(star.name)}, raHours: ${star.raHours}, decDeg: ${star.decDeg}, magnitude: ${star.magnitude}${color} },`
    })
    .join('\n')
  return `export interface BrightStar {
  id: string
  name: string
  raHours: number
  decDeg: number
  magnitude: number
  colorIndex?: number
}

// Generated by scripts/generate-bright-stars.mjs.
// Source: ${sourceLabel}
// Magnitude limit: ${MAX_MAG}
export const BRIGHT_STARS: BrightStar[] = [
${rows}
]
`
}

async function loadSource() {
  const inputIndex = process.argv.indexOf('--input')
  if (inputIndex >= 0) {
    const inputPath = process.argv[inputIndex + 1]
    if (!inputPath) throw new Error('--input requires a file path')
    return { text: await readFile(inputPath, 'utf8'), source: inputPath }
  }

  try {
    const response = await fetch(VIZIER_URL)
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return { text: await response.text(), source: VIZIER_URL }
  } catch (error) {
    console.warn(`Could not fetch VizieR catalog; using fallback seed. ${error.message}`)
    return { text: null, source: 'fallback seed list' }
  }
}

async function main() {
  const { text, source } = await loadSource()
  const stars = text ? parseTsv(text) : fallbackCatalog()
  if (stars.length === 0) throw new Error('Generated catalog is empty')
  await writeFile(OUT_FILE, renderCatalog(stars, source))
  console.log(`Wrote ${stars.length} stars to ${path.relative(ROOT, OUT_FILE)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
