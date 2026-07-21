import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const dir = path.join(root, 'public', 'app-video')
const video = path.join(dir, 'atlas-mobile-app-demo.webm')
const audio = path.join(dir, 'atlas-mobile-app-demo-narration.wav')

function run(args) {
  const result = spawnSync('ffmpeg', args, { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function duration(file) {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ], { encoding: 'utf8' })
  if (result.status !== 0) process.exit(result.status ?? 1)
  return Number(result.stdout.trim())
}

const padSeconds = Math.max(0, duration(audio) - duration(video) + 0.1)

const shared = [
  '-y',
  '-i', video,
  '-i', audio,
  '-filter_complex', `[0:v]tpad=stop_mode=clone:stop_duration=${padSeconds.toFixed(3)}[v]`,
  '-map', '[v]',
  '-map', '1:a:0',
  '-shortest',
]

run([
  ...shared,
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '21',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '160k',
  '-movflags', '+faststart',
  path.join(dir, 'atlas-mobile-app-demo-narrated.mp4'),
])

run([
  ...shared,
  '-c:v', 'libsvtav1',
  '-preset', '8',
  '-crf', '35',
  '-c:a', 'libopus',
  '-b:a', '128k',
  path.join(dir, 'atlas-mobile-app-demo-narrated.webm'),
])
