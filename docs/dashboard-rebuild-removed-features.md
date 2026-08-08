# Dashboard rebuild: what was cut, and why

KES-131's Dashboard rebuild (see `src/pages/DashboardPage.tsx`) was cut down hard, on
direct product direction: the page had accumulated into a kitchen-sink of nine-plus
stacked sections, and the fix is not to reorganize that same amount of content into
more pages -- it's to delete it and only bring back what's actually needed.

Dashboard now keeps only: the tonight/hold-for-clear-skies briefing (kicker, heading,
sky map preview, map readout, phone-pointing row, stat grid), and the tonight's-events
target feed with its tap-to-detail flow (equipment prompt on first tap, then the entry
detail page). That's the core "what should I look at tonight" loop the app exists for.

Everything else that used to render on Dashboard was removed outright, not relocated
by this pass. Noting each one here so it isn't silently lost:

- **Major events banner** (upcoming eclipse/meteor-shower image cards) -- overlapped
  with what Events already lists; cut rather than duplicated.
- **"For you" personalized feed + the event-preference prompt** that fed it -- same
  overlap with Events. If personalization comes back, it belongs on the Events page,
  next to the events it's personalizing.
- **Camera setup** (mode/lens/stability for the default device) -- duplicated a
  simpler version of the camera recipe already shown in the entry-detail page for
  whatever target you tap.
- **Sky conditions week outlook** (the 3/16-day viewing-conditions list, free-tier
  lookahead cap) -- belongs with Plan's forecasting, not Dashboard. The
  `forecastLookaheadDays` entitlement gate and `getWeekConditions` call this drove are
  untouched in `src/lib/*`; only the Dashboard UI for it is gone.
- **Watchlist grid** -- has no other home yet. Needs one (Plan, or its own page)
  before it's worth rebuilding.
- **Weekly streak + leaderboard** -- Settings already has `LeaderboardSettings` for
  the leaderboard opt-in; the streak count itself has no home right now.
- **Citizen science section** -- cut permanently, not just relocated. Direct
  feedback: it was just outbound links to Zooniverse and wasn't worth the space.
  `src/lib/citizenScience.ts` and `CitizenScienceSection.tsx` were deleted with it.
- **Community digest** ("this week's top discoveries") -- Journal's Community tab
  already covers this; Dashboard's copy of it was redundant.
- **Get-ready reminders** -- belongs with Plan, where reminders are set.
- **The standalone "After observing / Log attempt" button** below the stat grid --
  it duplicated the "Log attempt" button already on the entry-detail page you reach
  by tapping a target, so it's gone too.

None of the underlying data/logic in `src/lib/*` was touched -- this was a UI-layer
cut. Anything above can come back as real, separate, single-purpose pages if/when
they're actually wanted, rather than being re-stacked back onto Dashboard.
