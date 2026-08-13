import { useEffect, useRef, useState } from 'react'
import { ShareIcon } from '../ui/icons'

interface PostShareDialogProps {
  onCreateLink: () => Promise<string>
}

export function PostShareDialog({ onCreateLink }: PostShareDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  async function createLink() {
    setBusy(true)
    setStatus(null)
    try {
      const nextUrl = await onCreateLink()
      setUrl(nextUrl)
      try {
        await navigator.clipboard.writeText(nextUrl)
        setStatus('Link copied. Anyone with it can view this post.')
      } catch {
        setStatus('Link ready — copy it from the field below.')
      }
    } catch {
      setStatus('Could not create a link. Please sign in and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    if (!url) return
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Atlas check-in', url })
        setStatus('Shared.')
      } catch {
        // Closing the native share sheet is not an error worth surfacing.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setStatus('Link copied.')
    } catch {
      setStatus('Link ready — copy it from the field below.')
    }
  }

  return (
    <>
      <button type="button" className="scrapbook-share-icon" aria-label="Share this check-in" title="Share this check-in" onClick={() => setOpen(true)}>
        <ShareIcon />
      </button>
      {open && (
        <dialog
          className="post-share-dialog"
          ref={dialogRef}
          aria-labelledby="post-share-title"
          onClose={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        >
          <form method="dialog" className="post-share-dialog__content">
            <div className="post-share-dialog__heading">
              <div>
                <p className="post-share-dialog__kicker">Share check-in</p>
                <h2 id="post-share-title">A link to this post</h2>
              </div>
              <button type="submit" className="post-share-dialog__close" aria-label="Close share dialog">×</button>
            </div>
            <p>Make this individual journal post viewable to anyone with its link. Your other check-ins stay private.</p>
            {url ? (
              <>
                <input className="post-share-dialog__url" value={url} readOnly aria-label="Share link" onFocus={(event) => event.currentTarget.select()} />
                <button type="button" className="scrapbook-submit" onClick={share}>
                  <ShareIcon /> Share link
                </button>
              </>
            ) : (
              <button type="button" className="scrapbook-submit" disabled={busy} onClick={createLink}>
                {busy ? 'Creating link…' : 'Create share link'}
              </button>
            )}
            {status && <p className="post-share-dialog__status" role="status">{status}</p>}
          </form>
        </dialog>
      )}
    </>
  )
}
