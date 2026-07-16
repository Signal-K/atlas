# Camera Preset Bundles

Atlas exports camera setup as `.atlas-preset.json` bundles. These are real,
downloadable Atlas presets, but native install support depends on each camera
ecosystem.

## Current install reality

- **Nothing**: no stable public user-preset import/export file format is
  confirmed. Atlas bundles are downloadable and can be mapped later by a
  PocketBase/backend adapter if Nothing exposes a format.
- **Samsung**: users can copy values into Pro mode / Expert RAW where
  available. Atlas stores the bundle for reuse.
- **Google Pixel**: Night Sight / Astrophotography are workflow driven, not
  web-preset install driven. Atlas bundles act as setup cards.
- **Apple**: Photographic Styles / Camera settings are not installable from a
  generic web preset file. Atlas bundles can feed a Shortcut/manual setup.
- **Other Android**: manual-copy setup.

## PocketBase extension target

Use `scripts/pocketbase/atlas_camera_preset_bundles.collection.json` as the
collection contract for a backend extension. A future adapter can:

1. Store Atlas bundles against `target_key`, `device_maker`, and `device_model`.
2. Serve signed bundle downloads.
3. Map `bundle.settings` to a native vendor format if a vendor later exposes a
   documented import format.
4. Keep `native_install_supported=false` until that mapping is verified per
   model.
