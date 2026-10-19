// Minimal JPEG+EXIF builders for the backdated-check-in spec.
//
// Hand-built rather than committed as binary fixtures: the interesting part of
// these files is their metadata, and a base64 blob in the repository would hide
// exactly the values the test depends on (which day, which zone, which
// coordinate -- the whole feature is date and place arithmetic). Building them
// here also means a new case is a new argument, not a new binary.
//
// Only what `extractPhotoExif` reads is written: IFD0, an Exif sub-IFD with
// DateTimeOriginal/OffsetTimeOriginal, and a GPS IFD with a lat/lon pair. No
// image data -- exifr scans segments, it does not decode pixels.

const TAG_EXIF_IFD_POINTER = 0x8769
const TAG_GPS_IFD_POINTER = 0x8825
const TAG_DATE_TIME_ORIGINAL = 0x9003
const TAG_OFFSET_TIME_ORIGINAL = 0x9011
const TAG_GPS_LAT_REF = 0x0001
const TAG_GPS_LAT = 0x0002
const TAG_GPS_LON_REF = 0x0003
const TAG_GPS_LON = 0x0004
const TAG_GPS_IMG_DIRECTION = 0x0011

const TYPE_ASCII = 2
const TYPE_LONG = 4
const TYPE_RATIONAL = 5

interface RawEntry {
  tag: number
  type: number
  count: number
  payload: Uint8Array
}

function ascii(value: string): Uint8Array {
  // EXIF ASCII strings are NUL-terminated, and the count includes the NUL.
  return new TextEncoder().encode(`${value}\0`)
}

function long(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value, true)
  return bytes
}

/** One coordinate component as a degrees/minutes/seconds triple of rationals. */
function dmsRationals(degrees: number, count: number): Uint8Array {
  const totalSeconds = Math.abs(degrees) * 3600
  const d = Math.floor(totalSeconds / 3600)
  const rem = totalSeconds - d * 3600
  const m = Math.floor(rem / 60)
  const s = Math.round(rem - m * 60)
  const components = [d, m, s]

  const bytes = new Uint8Array(24)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < count; i += 1) {
    view.setUint32(i * 8, components[i], true)
    view.setUint32(i * 8 + 4, 1, true)
  }
  return bytes
}

/** An IFD is a count, 12 bytes per entry, and a next-IFD offset. */
function ifdByteLength(entryCount: number): number {
  return 2 + entryCount * 12 + 4
}

function writeIfd(view: DataView, offset: number, entries: RawEntry[], cursor: { value: number }): void {
  view.setUint16(offset, entries.length, true)
  let p = offset + 2

  for (const entry of entries) {
    view.setUint16(p, entry.tag, true)
    view.setUint16(p + 2, entry.type, true)
    view.setUint32(p + 4, entry.count, true)

    if (entry.payload.length <= 4) {
      // Inline: the value lives in the entry's own four bytes, left-aligned.
      new Uint8Array(view.buffer, view.byteOffset + p + 8, 4).set(entry.payload)
    } else {
      view.setUint32(p + 8, cursor.value, true)
      new Uint8Array(view.buffer, view.byteOffset + cursor.value, entry.payload.length).set(entry.payload)
      // Keep every block on an even boundary -- the TIFF spec requires it, and
      // an odd offset is the classic "parses locally, fails elsewhere" bug.
      cursor.value += entry.payload.length + (entry.payload.length % 2)
    }
    p += 12
  }

  view.setUint32(p, 0, true) // no next IFD
}

function dataAreaLength(entries: RawEntry[]): number {
  let total = 0
  for (const entry of entries) {
    if (entry.payload.length > 4) total += entry.payload.length + (entry.payload.length % 2)
  }
  return total
}

function buildTiff(ifd0: RawEntry[], exif: RawEntry[], gps: RawEntry[]): Uint8Array {
  const headerLength = 8
  // IFD0 holds the caller's entries *plus* the two sub-IFD pointers, which are
  // appended below once their offsets are known. Count them here or every
  // offset after IFD0 lands 24 bytes short of the buffer.
  const rootIfd: RawEntry[] = [
    ...ifd0,
    { tag: TAG_EXIF_IFD_POINTER, type: TYPE_LONG, count: 1, payload: new Uint8Array(4) },
    { tag: TAG_GPS_IFD_POINTER, type: TYPE_LONG, count: 1, payload: new Uint8Array(4) },
  ]

  const ifd0Length = ifdByteLength(rootIfd.length)
  const exifLength = ifdByteLength(exif.length)
  const gpsLength = ifdByteLength(gps.length)
  const exifOffset = headerLength + ifd0Length
  const gpsOffset = exifOffset + exifLength
  const fixedLength = headerLength + ifd0Length + exifLength + gpsLength
  const total = fixedLength + dataAreaLength(rootIfd) + dataAreaLength(exif) + dataAreaLength(gps)

  const bytes = new Uint8Array(total)
  const view = new DataView(bytes.buffer)

  // Little-endian TIFF header, IFD0 immediately after it.
  bytes[0] = 0x49
  bytes[1] = 0x49
  view.setUint16(2, 42, true)
  view.setUint32(4, headerLength, true)

  // Pointers are LONG values, so both are filled in now that the offsets are known.
  const pointer = (tag: number, value: number): RawEntry => ({
    tag,
    type: TYPE_LONG,
    count: 1,
    payload: long(value),
  })
  rootIfd[rootIfd.length - 2] = pointer(TAG_EXIF_IFD_POINTER, exifOffset)
  rootIfd[rootIfd.length - 1] = pointer(TAG_GPS_IFD_POINTER, gpsOffset)

  const cursor = { value: fixedLength }
  writeIfd(view, headerLength, rootIfd, cursor)
  writeIfd(view, exifOffset, exif, cursor)
  writeIfd(view, gpsOffset, gps, cursor)

  return bytes
}

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values)
}

// A real 1x1 grayscale image, assembled from the Annex K tables. The EXIF
// segment cannot simply be followed by EOI: exifr's JPEG walker only recovers a
// segment when the file is longer than the segment's end, and answering
// "Segment unreachable" for a 62-byte EXIF-only file is exactly how this was
// found. The image data also gives the sheet's preview an actual picture.
const SCAN_HEADER = bytes(
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, // SOF0
  0xff, 0xdb, 0x00, 0x43, 0x00, // DQT, table 0
  0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14,
  0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a,
  0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c,
  0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32,
  // DC luminance huffman table
  0xff, 0xc4, 0x00, 0x1f, 0x00,
  0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
  // AC luminance huffman table
  0xff, 0xc4, 0x00, 0xb5, 0x10,
  0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
  0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
  0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
  0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
  0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
  0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
  0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
  0xf9, 0xfa,
  // SOS, then one block: DC category 0 ("0"), AC end-of-block ("100"), padded.
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0x4f,
)

function wrapJpeg(tiff: Uint8Array): Buffer {
  const exifHeader = new TextEncoder().encode('Exif\0\0')
  // A JPEG segment's length field counts itself plus the payload, not the marker.
  const segmentLength = 2 + exifHeader.length + tiff.length
  // The marker is not part of the segment, so the array is longer than its length field.
  const app1 = new Uint8Array(2 + segmentLength)
  app1[0] = 0xff
  app1[1] = 0xe1
  app1[2] = (segmentLength >> 8) & 0xff
  app1[3] = segmentLength & 0xff
  app1.set(exifHeader, 4)
  app1.set(tiff, 4 + exifHeader.length)

  return Buffer.concat([
    Buffer.from(bytes(0xff, 0xd8)), // SOI
    Buffer.from(app1),
    Buffer.from(SCAN_HEADER),
    Buffer.from(bytes(0xff, 0xd9)), // EOI
  ])
}

export interface ExifImageOptions {
  /** EXIF's own format, always naive wall clock: 'YYYY:MM:DD HH:MM:SS'. */
  dateTimeOriginal: string
  /** The camera's UTC offset, e.g. '+01:00'. Omit to exercise the derived paths. */
  offsetTime?: string
  latitude: number
  longitude: number
  /** GPSImgDirection -- the compass heading, 0-360. */
  headingDeg?: number
  name?: string
}

/** A JPEG carrying DateTimeOriginal, optionally an offset, and a GPS position. */
export function exifJpeg(options: ExifImageOptions): { name: string; mimeType: string; buffer: Buffer } {
  const exif: RawEntry[] = [
    { tag: TAG_DATE_TIME_ORIGINAL, type: TYPE_ASCII, count: 20, payload: ascii(options.dateTimeOriginal) },
  ]
  if (options.offsetTime) {
    exif.push({ tag: TAG_OFFSET_TIME_ORIGINAL, type: TYPE_ASCII, count: 7, payload: ascii(options.offsetTime) })
  }

  const gps: RawEntry[] = [
    {
      tag: TAG_GPS_LAT_REF,
      type: TYPE_ASCII,
      count: 2,
      payload: ascii(options.latitude < 0 ? 'S' : 'N'),
    },
    { tag: TAG_GPS_LAT, type: TYPE_RATIONAL, count: 3, payload: dmsRationals(options.latitude, 3) },
    {
      tag: TAG_GPS_LON_REF,
      type: TYPE_ASCII,
      count: 2,
      payload: ascii(options.longitude < 0 ? 'W' : 'E'),
    },
    { tag: TAG_GPS_LON, type: TYPE_RATIONAL, count: 3, payload: dmsRationals(options.longitude, 3) },
  ]
  if (options.headingDeg != null) {
    const heading = new Uint8Array(8)
    const headingView = new DataView(heading.buffer)
    headingView.setUint32(0, Math.round(options.headingDeg), true)
    headingView.setUint32(4, 1, true)
    gps.push({ tag: TAG_GPS_IMG_DIRECTION, type: TYPE_RATIONAL, count: 1, payload: heading })
  }

  return {
    name: options.name ?? 'backdated-checkin.jpg',
    mimeType: 'image/jpeg',
    buffer: wrapJpeg(buildTiff([], exif, gps)),
  }
}

/**
 * The same shell with no EXIF at all -- the manual-description path, where the
 * user types the day and place and the entry goes to review.
 */
export function strippedJpeg(name = 'no-exif.jpg'): { name: string; mimeType: string; buffer: Buffer } {
  return { name, mimeType: 'image/jpeg', buffer: wrapJpeg(buildTiff([], [], [])) }
}
