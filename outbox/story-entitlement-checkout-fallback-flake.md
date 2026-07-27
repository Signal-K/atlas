---
id: story-entitlement-checkout-fallback-flake
type: story
epic: epic-ci-test-reliability
title: Known flake — dynamic Polar checkout fallback tests in entitlement-refresh.spec.ts
status: backlog
priority: low
---

# Known flake — dynamic Polar checkout fallback tests in entitlement-refresh.spec.ts

## What's happening

Two tests in `e2e/entitlement-refresh.spec.ts` intermittently fail in CI
(`ci.yml`'s `test` job, not the preview-deploy job):

- `falls back when dynamic Polar checkout creation fails`
- `settings Sky Pass CTA uses dynamic checkout and falls back when unavailable`

Both mock `POST ${PB_URL}/checkout/polar` to return 500, click "Get the
Sky Pass," and expect the app to fall back to `VITE_POLAR_CHECKOUT_URL`
(`window.location.href = POLAR_CHECKOUT_URL` in
`PaywallGate.tsx`'s/`AccountSettings.tsx`'s `handleCheckoutClick`). In CI
they sometimes land back on `/plan` or `/settings` instead of
`/fallback-checkout` -- i.e. the click never triggered the fallback
navigation in time. On the same run, a retry of the same test sometimes
passes.

## Status: confirmed pre-existing, not a regression

Reproduced identically across several unrelated commits (session
investigation on 2026-07-26 and again on 2026-07-27, on code neither
commit touched). `handleCheckoutClick`'s logic reads correctly on
inspection: `refreshEntitlement()` (best-effort, mocked to return
`entitled: false`) → `startPolarCheckout()` (mocked to reject on the 500)
→ caught → `window.location.href = POLAR_CHECKOUT_URL`. No code path
skips the fallback. Left as an open, tracked flake rather than guessing
at a speculative fix in an area outside what was actually asked for --
the two "Deploy Cloudflare Pages preview" runs this session's timezone
fix was validating against were unaffected by this (different job,
different failure mode entirely: `.tonight-target-main` never
rendering, now fixed separately).

## Next step, if picked up

Worth a closer look with Playwright's trace viewer on a failing run
specifically for whether the click fires before React's event handler
attaches, or whether `window.location.href` assignment isn't flushing to
`page.url()` before the 5s assertion window in a loaded CI runner. Not
investigated further this session.
