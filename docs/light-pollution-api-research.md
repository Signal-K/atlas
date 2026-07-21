# Light-pollution API research

## Recommendation

Phase 1 should stay **zero-infra**: use the local `estimateLightPollution()`
model in `src/lib/darkSky.ts` as Atlas's light-pollution lookup. It runs
entirely in the browser from bundled/static data, so it adds no Fly.io compute,
no PocketBase read load, no Cloudflare Worker calls, and no paid third-party
API dependency.

The `atlas_light_pollution_samples` PocketBase collection exists as a future
cache target only. Do not put the client on a PocketBase light-pollution read
path until we decide the improved accuracy is worth the infrastructure cost.

Best future data source:

- **New World Atlas of Artificial Night Sky Brightness**: stable global raster
  data suitable for Bortle/SQM estimates and app caching. It is dataset-shaped,
  not a simple consumer HTTP API, so Atlas should ingest or sample it server-side.

Good future freshness layer:

- **NASA Black Marble / VIIRS nighttime lights**: official nighttime-light
  satellite products with daily/monthly/yearly options. This is useful for
  updates and trend/freshness, but it is remote-sensing radiance data, not a
  direct Bortle answer.

Avoid for now:

- **lightpollutionmap.info as an app dependency**: useful reference UI, but no
  clearly documented public app API in the project. Treat it as inspiration or
  a manually verified source until a commercial/API agreement exists.

## Product mapping

- Free: current-location light-pollution estimate for today and tomorrow.
- Premium: unlimited lookups, lower-light-pollution nearby recommendations,
  route/transit links, and other-location/holiday planning.
- Implementation now: client uses `estimateLightPollution()` only.
- Implementation later: client may read from `atlas_light_pollution_samples`
  once a resolver exists, with `estimateLightPollution()` kept as the offline
  fallback.

## Sources Checked

- NASA Black Marble product docs:
  https://blackmarble.gsfc.nasa.gov/
- NASA Earthdata nighttime lights / VIIRS Black Marble background:
  https://earthdata.nasa.gov/topics/human-dimensions/nighttime-lights
- GFZ Data Services entry for the New World Atlas of Artificial Night Sky
  Brightness:
  https://dataservices.gfz-potsdam.de/panmetaworks/showshort.php?id=escidoc%3A1541893
- David Lorenz Light Pollution Atlas download/reference pages:
  https://djlorenz.github.io/astronomy/lp2022/

## Open Work

1. Keep improving the zero-infra estimator with small bundled static data:
   known city baselines, known dark sites, and coarse regional overrides.
2. Build a server-side sampler only if the local estimator becomes visibly
   misleading. It should round coordinates, read the selected
   raster/source product, computes `bortle_class` and optional
   `sqm_mag_arcsec2`, then stores rows in `atlas_light_pollution_samples`.
3. Add cache freshness rules by provider/product. Static Atlas data can be long
   lived; VIIRS-derived rows should carry source dates and be refreshed on a
   schedule.
4. Validate Bortle conversion thresholds against known dark-sky parks and major
   city centers before using the output in paid planning copy.
