import { useState } from 'react'
import { ClerkProvider, useClerk } from '@clerk/react'
import { authErrorMessage, deleteAccount } from '../lib/auth'
import { trackEvent } from '../lib/analytics'

type Panel = null | 'delete'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

// Password and email are Clerk's to manage since KES-189 -- PocketBase's own
// `users.password` is a random value nobody ever sees (set via
// SetRandomPassword() in the Clerk exchange handler) and its `email` field
// only mirrors whatever Clerk reports at last sign-in, so editing either one
// through PocketBase's own API here would silently desync from the identity
// Clerk actually authenticates against, or just always fail (an "old
// password" prompt the account owner has no way to answer correctly).
// Clerk's own account portal is the one place that's actually correct.
export function AccountManagement({ email }: { email: string }) {
  const [openPanel, setOpenPanel] = useState<Panel>(null)

  return (
    <div className="settings-account-management">
      <div className="settings-account-actions">
        {clerkPublishableKey ? (
          <ClerkProvider publishableKey={clerkPublishableKey}>
            <ManageAccountButton />
          </ClerkProvider>
        ) : null}
        <button type="button" className="settings-status--negative" onClick={() => setOpenPanel(openPanel === 'delete' ? null : 'delete')}>
          Delete account
        </button>
      </div>
      {openPanel === 'delete' && <DeleteAccountForm email={email} onCancel={() => setOpenPanel(null)} />}
    </div>
  )
}

function ManageAccountButton() {
  const clerk = useClerk()
  return (
    <button type="button" onClick={() => clerk.openUserProfile()}>
      Manage password &amp; email
    </button>
  )
}

function DeleteAccountForm({ email, onCancel }: { email: string; onCancel: () => void }) {
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setError(null)
    setBusy(true)
    trackEvent('Account deletion requested')
    try {
      await deleteAccount()
      trackEvent('Account deleted')
      // deleteAccount() clears the session -- the auth-state listener in
      // useAuth() re-renders the app back to signed-out on its own.
    } catch (err) {
      setError(authErrorMessage(err, 'Could not delete account. Contact support if this keeps happening.'))
      setBusy(false)
    }
  }

  return (
    <div className="account-form settings-status--negative-panel">
      <p className="settings-help">
        This permanently deletes your account and everything tied to it. This can't be undone. Type your email (
        <strong>{email}</strong>) to confirm.
      </p>
      <input
        type="email"
        placeholder={email}
        value={confirmText}
        onChange={(event) => setConfirmText(event.target.value)}
      />
      <div className="account-form-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="settings-status--negative"
          onClick={handleDelete}
          disabled={busy || confirmText.trim().toLowerCase() !== email.trim().toLowerCase()}
        >
          {busy ? 'Deleting…' : 'Permanently delete account'}
        </button>
      </div>
      {error && <p className="account-form-error">{error}</p>}
    </div>
  )
}
