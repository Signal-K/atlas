import type { AuthUser } from '../lib/auth'
import { signOut } from '../lib/auth'
import { AccountManagement } from '../components/AccountManagement'
import { SubscriptionCard } from '../components/SubscriptionCard'
import { PreviewFreeToggle } from '../components/PreviewFreeToggle'
import { DeviceSettings } from '../components/DeviceSettings'

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

      <DeviceSettings deviceModels={user.deviceModels} entitled={user.entitled} />

      <section className="ui-section">
        <h2 className="ui-section-title">Account settings</h2>
        <AccountManagement email={user.email} />
        <button type="button" className="ui-button ui-account-signout" onClick={() => signOut()}>
          Sign out
        </button>
      </section>

      <PreviewFreeToggle />
    </div>
  )
}
