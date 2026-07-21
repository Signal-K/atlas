import { readFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

const root = process.cwd()
const inputPath = path.join(root, 'public', 'app-video', 'atlas-mobile-app-demo-narration.txt')
const outputPath = path.join(root, 'public', 'app-video', 'atlas-mobile-app-demo-narration.wav')
const referencePath = process.env.ATLAS_VOICE_REFERENCE
  || '/Users/scroobz/Documents/NotOnce/Morning/Resources/VoiceReferences/CarlaOstmann/carla-ostmann-long-accent-reference.wav'
const voiceServer = process.env.ATLAS_VOICE_SERVER || 'http://127.0.0.1:8765'

const text = (await readFile(inputPath, 'utf8')).trim()
const payload = JSON.stringify({
  text,
  reference_audio_path: referencePath,
  output_path: outputPath,
})

const result = await new Promise((resolve, reject) => {
  const request = http.request(new URL('/synthesize', voiceServer), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    },
  }, (response) => {
    let body = ''
    response.setEncoding('utf8')
    response.on('data', (chunk) => { body += chunk })
    response.on('end', () => {
      if ((response.statusCode ?? 500) >= 400) {
        reject(new Error(`Voice renderer failed (${response.statusCode}): ${body}`))
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
  })
  request.on('error', reject)
  request.end(payload)
})

console.log(result.output_path || outputPath)
