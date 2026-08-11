import { useState } from 'react'
import { authErrorMessage, changePassword, deleteAccount, requestEmailChange } from '../lib/auth'
import { trackEvent } from '../lib/analytics'

type Panel = null | 'password' | 'email' | 'delete'

export function AccountManagement({ email }: { email: string }) {
  const [openPanel, setOpenPanel] = useState<Panel>(null)

  function toggle(panel: Panel) {
    setOpenPanel((current) => (current === panel ? null : panel))
  }

  return (
    <div className="settings-account-management">
      <div className="settings-account-actions">
        <button type="button" className="ui-button" onClick={() => toggle('password')}>
          Change password
        </button>
        <button type="button" className="ui-button" onClick={() => toggle('email')}>
          Change email
        </button>
        <button type="button" className="ui-button ui-button-danger" onClick={() => toggle('delete')}>
          Delete account
        </button>
      </div>
      {openPanel === 'password' && <ChangePasswordForm onDone={() => setOpenPanel(null)} />}
      {openPanel === 'email' && <ChangeEmailForm onDone={() => setOpenPanel(null)} />}
      {openPanel === 'delete' && <DeleteAccountForm email={email} onCancel={() => setOpenPanel(null)} />}
    </div>
  )
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (newPassword !== confirm) {
      setError('New passwords don’t match.')
      return
    }
    setBusy(true)
    try {
      await changePassword(oldPassword, newPassword)
      trackEvent('Password changed')
      setDone(true)
      window.setTimeout(onDone, 1500)
    } catch (err) {
      setError(authErrorMessage(err, 'Could not change password — check your current password.'))
    } finally {
      setBusy(false)
    }
  }

  if (done) return <p className="settings-help settings-status--positive">Password updated.</p>

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <input
        className="ui-input"
        type="password"
        placeholder="Current password"
        value={oldPassword}
        onChange={(event) => setOldPassword(event.target.value)}
        required
      />
      <input
        className="ui-input"
        type="password"
        placeholder="New password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        minLength={8}
        required
      />
      <input
        className="ui-input"
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        minLength={8}
        required
      />
      <div className="account-form-actions">
        <button type="submit" className="ui-button ui-button-primary" disabled={busy}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </div>
      {error && <p className="account-form-error">{error}</p>}
    </form>
  )
}

function ChangeEmailForm({ onDone }: { onDone: () => void }) {
  const [newEmail, setNewEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await requestEmailChange(newEmail)
      trackEvent('Email change requested')
      setSent(true)
    } catch (err) {
      setError(authErrorMessage(err, 'Could not start email change.'))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <p className="settings-help settings-status--positive">
        Confirmation link sent to {newEmail}. Your email stays the same until you open it.{' '}
        <button type="button" className="ui-button ui-button-ghost" onClick={onDone}>
          Done
        </button>
      </p>
    )
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <input
        className="ui-input"
        type="email"
        placeholder="New email address"
        value={newEmail}
        onChange={(event) => setNewEmail(event.target.value)}
        required
      />
      <div className="account-form-actions">
        <button type="submit" className="ui-button ui-button-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send confirmation link'}
        </button>
      </div>
      {error && <p className="account-form-error">{error}</p>}
    </form>
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
        className="ui-input"
        type="email"
        placeholder={email}
        value={confirmText}
        onChange={(event) => setConfirmText(event.target.value)}
      />
      <div className="account-form-actions">
        <button type="button" className="ui-button ui-button-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="ui-button ui-button-danger"
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
