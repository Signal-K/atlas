import { useEffect, useState } from 'react'

// Object-URL lifecycle for a locally-stored observation photo Blob --
// shared by the Journal row list and entry-detail sheet so a real captured
// photo renders instead of a placeholder. Mirrors the pattern already used
// by ObservationCard.tsx / EventObservationThread.tsx.
export function useEntryPhotoUrl(photo: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!photo || !photo.type.startsWith('image/')) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(photo)
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
    }
  }, [photo])

  return url
}
