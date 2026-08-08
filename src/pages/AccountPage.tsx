import type { AuthUser } from '../lib/auth'
import { signOut } from '../lib/auth'
import { AccountManagement } from '../components/AccountManagement'
import { SubscriptionCard } from '../components/SubscriptionCard'

export interface AccountPageProps {
  user: AuthUser
  entitlementRefreshing: boolean
}

export function AccountPage({ user, entitlementRefreshing }: AccountPageProps) {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Account</h1>
        <p>Signed in as {user.email}</p>
      </div>

      <SubscriptionCard user={user} entitlementRefreshing={entitlementRefreshing} />

      <section className="ui-section">
        <h2 className="ui-section-title">Account settings</h2>
        <AccountManagement email={user.email} />
      </section>

      <section className="ui-section">
        <button type="button" className="ui-button" onClick={() => signOut()}>
          Sign out
        </button>
      </section>
    </div>
  )
}
