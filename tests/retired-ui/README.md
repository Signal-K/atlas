# Retired interface scenarios

These scenarios describe the landing page, dashboard, mobile drawers, paywall and other screens removed in the ASV-150 interface replacement. Their source is retained for recovery and acceptance-criteria migration; they are not tests of the replacement UI. They must not be marked as passed.

The release suite is e2e/workspace.spec.ts, covering current navigation, journal/history/skills evidence, calendar persistence, equipment filtering, forecast parsing, daily observing focus, and education progression. Pure domain tests remain in test/ and run unchanged.

Restoring an old product capability requires porting its applicable scenario into the current release suite, alongside implementation. Authentication-provider and production-write tests require separate credentials and a provisioned non-production backend; current fixture tests do not validate those integrations.
