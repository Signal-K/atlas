const MAX_EDGE_PX = 4096
const JPEG_QUALITY = 0.92

export class PhotoOptimizationError extends Error {}

function outputName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '') || 'observation'
  return `${stem}-atlas.jpg`
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new PhotoOptimizationError('This photo could not be prepared for upload.'))
    }, 'image/jpeg', JPEG_QUALITY)
  })
}

// Keep an excellent display-quality master for the Journal while bounding
// storage. A 4096px JPEG at 92% preserves a useful crop for night-sky work
// but avoids silently storing 20–80MB phone/DSLR originals for every post.
// Original archival files can become an explicit paid tier later, rather
// than an invisible and expensive default.
export async function optimizeObservationPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new PhotoOptimizationError('Choose an image file.')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoOptimizationError('This image format cannot be prepared in this browser. Export it as JPEG, PNG, or WebP and try again.')
  }

  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    // Avoid a second lossy pass for an already-small JPEG.
    if (scale === 1 && file.type === 'image/jpeg' && file.size <= 1_500_000) return file

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new PhotoOptimizationError('This browser cannot prepare the image.')
    context.drawImage(bitmap, 0, 0, width, height)
    const optimized = await canvasBlob(canvas)
    return new File([optimized], outputName(file.name), { type: 'image/jpeg', lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}
