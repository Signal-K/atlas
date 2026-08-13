# Atlas R2 media storage

## What is stored

`atlas_observations` retains metadata and ownership, plus:

- `photo_r2_key` — private R2 object key
- `photo_r2_size` — bytes after preparation

The browser keeps the same image as a local IndexedDB preview. The R2 object
is not public and its key never appears in a public share URL.

## Upload and delivery path

1. Atlas prepares the selected image in the browser: maximum 4096px long edge,
   JPEG at 92% quality.
2. The browser sends it to `atlas-media` with the PocketBase session token.
3. The Worker refreshes that token, checks that the observation belongs to the
   caller, validates JPEG/PNG/WebP and a 12MB post-optimisation limit, then
   writes a user-scoped R2 key.
4. Atlas writes the returned key/size back to the user-owned PocketBase record.
5. Private Journal reads go through the Worker and re-check ownership. A public
   `/p/:id` share card goes through a separate Worker endpoint that first
   confirms `public = true` on that record.

An interrupted Worker upload leaves the local photo intact; a later Journal
sync retries it when the remote record has no R2 key and no legacy PocketBase
file.

## Capacity policy

The R2 free allowance is useful for launch, but it is not a library quota:

| Typical stored image | Approx. photos in 10GB |
| --- | ---: |
| 2MB optimised phone image | 5,000 |
| 5MB detailed night-sky image | 2,000 |
| 10MB large export | 1,000 |
| 40MB original camera JPEG | 250 |

Keep the default as the display-quality web master. Before adding originals,
introduce a visible per-plan allowance, storage analytics, lifecycle rules,
and an explicit “keep original” decision. R2 Infrequent Access is not a fit for
active Journal photos because it has retrieval fees and a 30-day minimum.

## Activation checklist

R2 must first be enabled once in the Cloudflare dashboard. Then:

```sh
wrangler r2 bucket create atlas-media --location=weur
wrangler deploy --config workers/atlas-media/wrangler.jsonc
```

Set the emitted Worker URL as the GitHub Actions variable
`VITE_ATLAS_MEDIA_URL`; deploy the PocketBase migration before the frontend.
The Worker’s `ALLOWED_ORIGINS` is intentionally explicit—add only real Atlas
origins, not `*`.
