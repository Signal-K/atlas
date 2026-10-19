// .xmp Lightroom preset exporter (KES-298). This is Adobe's public Camera Raw
// settings sidecar format -- Lightroom (desktop, and the mobile app on iOS
// and Android) imports .xmp files directly as Develop presets, which is the
// closest thing to a "native camera/editing environment" install path
// available on iOS today (Apple's own Camera app has no import mechanism for
// third-party grades). See KES-295/cube.ts for the Nothing .cube equivalent.
//
// Only the `look` half of a preset (LookSettings) maps onto a Develop preset.
// `capture` parameters (ISO, exposure, mode, lens) are camera-hardware
// controls at capture time, not a post-processing adjustment, so they stay a
// manual checklist -- see KES-295/KES-302.
import type { LookSettings } from '../db'

export interface XmpPresetOptions {
  name?: string
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function clampPercent(value: number | undefined): number {
  if (value === undefined) return 0
  return Math.round(Math.min(100, Math.max(-100, value)))
}

// Lightroom's Temperature/Tint fields are absolute (2000-50000K / -150..150),
// but Atlas only knows a relative shift from "as shot". IncrementalTemperature
// and IncrementalTint are the Develop-preset fields for exactly that case --
// a delta applied on top of whatever white balance the photo already has.
function toneCurveEntries(points: Array<[number, number]> | undefined): string {
  const sorted = points && points.length > 0 ? [...points].sort((a, b) => a[0] - b[0]) : []
  const withAnchors: Array<[number, number]> = []
  if (sorted.length === 0 || sorted[0][0] > 0) withAnchors.push([0, 0])
  withAnchors.push(...sorted)
  if (withAnchors[withAnchors.length - 1][0] < 255) withAnchors.push([255, 255])
  return withAnchors.map(([x, y]) => `     <rdf:li>${Math.round(x)}, ${Math.round(y)}</rdf:li>`).join('\n')
}

// Generates a Lightroom .xmp Develop preset from a preset's look settings.
export function generateXmpPreset(look: LookSettings, options: XmpPresetOptions = {}): string {
  const name = options.name ?? 'Atlas Preset'
  const temperatureShift = Math.round(look.temperatureShiftKelvin ?? 0)
  const tintShift = Math.round(look.tint ?? 0)

  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Atlas Camera Presets">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
   crs:PresetType="Normal"
   crs:UUID="${crypto.randomUUID()}"
   crs:SupportsAmount="False"
   crs:SupportsColor="True"
   crs:SupportsMonochrome="True"
   crs:SupportsHighDynamicRange="True"
   crs:SupportsNormalDynamicRange="True"
   crs:SupportsSceneReferred="True"
   crs:SupportsOutputReferred="True"
   crs:Version="15.0"
   crs:ProcessVersion="15.0"
   crs:WhiteBalance="Custom"
   crs:IncrementalTemperature="${temperatureShift}"
   crs:IncrementalTint="${tintShift}"
   crs:Contrast2012="${clampPercent(look.contrast)}"
   crs:Saturation="${clampPercent(look.saturation)}"
   crs:Highlights2012="${clampPercent(look.highlights)}"
   crs:Shadows2012="${clampPercent(look.shadows)}"
   crs:ToneCurveName2012="Custom"
   crs:HasSettings="True"
   crs:PresetSubtype="Look">
   <crs:Name>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${escapeXml(name)}</rdf:li>
    </rdf:Alt>
   </crs:Name>
   <crs:ToneCurvePV2012>
    <rdf:Seq>
${toneCurveEntries(look.toneCurve)}
    </rdf:Seq>
   </crs:ToneCurvePV2012>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>
`
}
