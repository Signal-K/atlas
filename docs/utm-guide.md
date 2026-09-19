# UTM tagging for Atlas promotion links (ASV-22)

## Problem

~94% of recent `youratlas.cc` traffic shows as Direct in PostHog web
analytics — channel quality is invisible, so we can't tell which shares are
actually driving visitors.

## Rule

Every link to `youratlas.cc` posted outside the app (social, communities,
personal shares) carries UTM params. PostHog reads standard `utm_source` /
`utm_medium` / `utm_campaign` query params automatically into
`$initial_utm_source` etc. and `InitialChannelType` — no code change needed,
this is a link-authoring discipline, not an app change.

## Naming scheme

`https://youratlas.cc/?utm_source=<source>&utm_medium=<medium>&utm_campaign=<campaign>`

| `utm_source` | `utm_medium` | When to use |
|---|---|---|
| `linkedin` | `social` | Personal or company LinkedIn posts |
| `reddit` | `social` | r/astronomy, r/telescopes, etc. |
| `discord` | `social` | Dark-sky / astro Discord servers |
| `producthunt` | `referral` | Product Hunt launch/listing |
| `eia` | `community` | EIA / alumni network shares |
| `personal` | `share` | 1:1 personal shares (DMs, texts) not covered above |

`utm_campaign` is freeform, lowercase, hyphenated, and names the specific
push — not the channel (that's already `utm_source`/`utm_medium`). Examples:
`launch-2026-09`, `polar-sky-pass-pricing`, `founder-interviews-ask`.

Full example:

```
https://youratlas.cc/?utm_source=reddit&utm_medium=social&utm_campaign=launch-2026-09
```

## Smoke test

After posting a tagged link and getting at least one click:

1. Open [Web analytics → Sources](https://us.posthog.com/project/199773/web-analytics) in PostHog.
2. Confirm the visit shows the configured `utm_source`/`utm_campaign` instead
   of Direct.
3. Note the confirmed link + result in the Linear ticket (ASV-22) as
   verification.

## Verification (18 Sep 2026)

No Atlas events in the last 30 days carried `utm_source` / `utm_medium` /
`utm_campaign` (all 1273 events / 68 people on Atlas hosts were untagged).
Until a real share uses the scheme above, morning reviews will still read
as Direct. Check [Web analytics](https://us.posthog.com/project/199773/web)
after the first tagged click.

## Result

With this in place, morning/weekly analytics reviews can break down
`InitialChannelType` / UTM source in `query-web-stats` and attribute non-direct
visits to the channel that actually drove them, instead of everything
collapsing into Direct.
