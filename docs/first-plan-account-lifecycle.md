# First-plan journey: account lifecycle (STS-332)

States from anonymous first visit through signed-in continuation, covering
the local-first data (target taps, equipment, favourites, plans, observation
notes) and where it does or doesn't survive a transition. Grounded in the
actual implementation as of this session:

- `src/lib/firstPlanJourney.ts` — target taps + equipment, plain `localStorage`
- `src/lib/db.ts` (Dexie) — favourites/watchlist/observations/camera presets,
  scoped by a fixed `'local'` user id until signup
- `src/lib/accountMerge.ts` — the local → account merge, run on signup
- `src/lib/getReadyReminders.ts` — reminders, account-independent, always
  `localStorage`-only (never migrated, since they're not scoped by user id)

```mermaid
stateDiagram-v2
    [*] --> FirstVisit

    FirstVisit: First visit (anonymous)
    FirstVisit --> LocationSubmitted: enters city or grants geolocation

    LocationSubmitted --> SignedOutFeed: enterApp() sets atlas-entered

    SignedOutFeed: Signed-out visible-tonight feed
    SignedOutFeed --> LocalTargetTap: taps a target card

    LocalTargetTap: Local target tap recorded\n(firstPlanJourney localStorage)
    LocalTargetTap --> EquipmentPrompt: shouldAskForEquipment() true
    LocalTargetTap --> FirstPlan: equipment already answered/dismissed

    EquipmentPrompt --> EquipmentAnswered: picks eyes/phone/binoculars/scope
    EquipmentPrompt --> EquipmentSkipped: "Skip for now"
    EquipmentAnswered --> FirstPlan
    EquipmentSkipped --> FirstPlan

    FirstPlan: First plan shown\n(best time / direction / camera / weather)
    FirstPlan --> RemindMePermission: taps "Remind me"
    FirstPlan --> SaveAction: favourites, saves, or logs an observation

    RemindMePermission: Reminder armed (no account required)\nlocalStorage only, never merged
    RemindMePermission --> FirstPlan

    SaveAction: Save/favourite/log action\n(Dexie row written under userId='local')
    SaveAction --> SignupModalShown: !user, not dismissed this session
    SaveAction --> SignedOutFeed: already signed in, or dismissed previously

    SignupModalShown: Signup wall shown (SignupWallModal)
    SignupModalShown --> LocalDataMerge: submits email/password
    SignupModalShown --> SignedOutFeed: "Not now" (dismissed for this browser)

    LocalDataMerge: Local data merge\n(mergeLocalDataIntoAccount)
    LocalDataMerge --> MergeConfirmation: dedupes + reassigns userId, best-effort pushes to PocketBase

    MergeConfirmation: Merge confirmation shown\n("brought over N saved items")
    MergeConfirmation --> WelcomeBeat

    WelcomeBeat: Welcome beat\n(not yet built -- see analytics contract gap)
    WelcomeBeat --> SignedInContinuation

    SignedInContinuation: Signed-in continuation
    SignedInContinuation --> ExistingPlanRestored: returns later, same device or after merge
    ExistingPlanRestored --> NotificationNudge: viewing window opens
    NotificationNudge --> PostWindowFeedback: window closes (not yet built)
    PostWindowFeedback --> SignedInContinuation
    ExistingPlanRestored --> SignedInContinuation
```

## What does and doesn't survive each transition

| Data | Where it lives signed out | On signup | On sign-in (existing account, new device) |
|---|---|---|---|
| Target taps | `localStorage` (`firstPlanJourney.ts`), never partitioned by user | Nothing to migrate — same `localStorage` key is read before and after signup, so it's never orphaned, just device/browser-scoped | Not restored on a new device — device-specific by design, no backend collection for it |
| Equipment choice | `localStorage`, never partitioned by user | Same as target taps | Not restored on a new device |
| Favourites | Dexie, `userId: 'local'` | Reassigned to the new user id, deduped, pushed to PocketBase (`accountMerge.ts`) | Pulled from PocketBase normally (existing sync path) |
| Watchlist | Dexie, `userId: 'local'` | Reassigned + deduped + pushed | Pulled normally |
| Observation notes | Dexie, `userId: 'local'` | Reassigned + pushed | Pulled normally |
| Camera presets | Dexie, `userId: 'local'` | Reassigned + deduped | Pulled normally |
| Get-ready reminders | `localStorage` (`getReadyReminders.ts`), never partitioned by user | Same as target taps — nothing to migrate | Not restored on a new device |

STS-322's "no local first-journey data is orphaned after signup" holds for two
different reasons: the Dexie-backed rows (favourites/watchlist/observations/
presets) are actively reassigned by `mergeLocalDataIntoAccount`, while target
taps/equipment/reminders were never partitioned by user id in the first place
— there's no `'local'` vs `<userId>` split for them to fall out of, so signing
up can't orphan them. They stay device-scoped rather than becoming account
state, which matches the acceptance criteria's actual concern (nothing
silently disappearing on signup) without inventing new backend collections
this session didn't call for.
