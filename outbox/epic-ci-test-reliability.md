---
id: epic-ci-test-reliability
type: epic
title: CI test reliability fixes
status: in-progress
priority: medium
source: "CI run 30238604971 (Deploy Cloudflare Pages preview) failing broadly on 8 e2e tests"
---

# CI test reliability fixes

Umbrella for pre-existing (not session-introduced) test-infra bugs found
while investigating CI failures.

## Child stories

- story-tonight-window-timezone-fallback
- story-entitlement-checkout-fallback-flake

## Status

The tonight-window timezone bug (broad 8-test failures) is root-caused
and fixed. A second, unrelated flake in `entitlement-refresh.spec.ts`'s
dynamic-Polar-checkout-fallback tests is confirmed pre-existing across
multiple unrelated commits and is tracked but not yet fixed -- see that
child story for what's been ruled out.
