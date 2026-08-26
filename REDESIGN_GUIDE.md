# Atlas Mobile Redesign Implementation

This document describes the new mobile redesign based on the Claude Design project: **Atlas Mobile.dc.html**

## What's New

### 1. **Design System (design-tokens.css)**

All colors, fonts, and theme variables are now centralized in `/src/design-tokens.css`. The system includes:

- **Fonts**: Turret Road (display), Oxanium (numeric), System UI (regular text)
- **Color palette**: Complete dark & light theme with category-specific astronomy colors
- **CSS custom properties**: `--bg`, `--fg`, `--accent`, `--go`, `--warn`, `--bad`, etc.
- **Astronomy category colors**: moon, planet, meteor, satellite, aurora, guide, asteroid

### 2. **Theme Support**

The redesign supports two themes:
- **Dark (default)**: Deep space aesthetic with bright accents
- **Light**: Clean bright palette with deep astronomy tones

Toggle via: `data-atlas-theme="dark"` or `data-atlas-theme="light"` on `<html>`

### 3. **Components**

#### **IOSDevice** (`/src/components/IOSDevice.tsx`)
Renders an iOS-style device frame with:
- Dynamic Island
- Status bar with signal/WiFi/battery
- Large navigation titles
- Glass morphism pill buttons
- Home indicator

Usage:
```tsx
import { IOSDevice } from './components'

<IOSDevice title="Tonight" dark={true}>
  {/* Screen content */}
</IOSDevice>
```

#### **AtlasMobileRedesign** (`/src/components/AtlasMobileRedesign.tsx`)
Complete mobile app redesign with:
- **5-tab navigation**: Tonight, Explore, Plan, Journal, Settings
- **Tonight screen**: Event listing with conditions chart, mode switcher (naked eye/binoculars/telescope)
- **Explore screen**: Search & filter for events
- **Journal screen**: Observation log with tabs
- **Location sheet**: Modal for changing observation location
- **Theme toggle**: Dark/Light in header

## Integration

### 1. **Import the Component**

```tsx
import { AtlasMobileRedesign } from './components/AtlasMobileRedesign'

export function MyApp() {
  return <AtlasMobileRedesign isDark={true} />
}
```

### 2. **Use Design Tokens in Your CSS**

```css
.my-component {
  color: var(--fg);
  background: var(--bg);
  border: 1px solid var(--line);
  font-family: var(--disp);
}
```

### 3. **Apply Theme to Entire App**

```tsx
// Set theme on root element
document.documentElement.dataset.atlasTheme = 'dark' // or 'light'
```

## File Structure

```
src/
├── components/
│   ├── IOSDevice.tsx           # iOS frame component
│   ├── AtlasMobileRedesign.tsx  # Main redesign
│   └── index.ts               # Component exports
├── styles/
│   ├── ios-device.css         # iOS frame styles
│   └── atlas-redesign.css     # Redesign styles
├── design-tokens.css          # Design system tokens
└── assets/
    └── fonts/
        ├── TurretRoad-Bold.woff2
        ├── TurretRoad-ExtraBold.woff2
        ├── Oxanium-Bold.woff2
        └── Oxanium-Bold-ext.woff2
```

## Key Features

### Color System
The redesign introduces category-specific colors for astronomy objects:
- `--c-moon`: #4fb3dd (dark) / #0a82b3 (light)
- `--c-planet`: #b57fd0 (dark) / #8a4ea1 (light)
- `--c-meteor`: #ef8354 (dark) / #d76131 (light)
- `--c-sat`: #84c46b (dark) / #5e944a (light)
- `--c-aurora`: #4fc7b6 (dark) / #2f9e8f (light)
- `--c-guide`: #d8a12a (dark) / #b07700 (light)
- `--c-ast`: #c9855e (dark) / #a15c3a (light)

### Type Hierarchy
- **Display**: Turret Road (800/700 weight) — headlines, titles
- **Numeric**: Oxanium (700 weight) — times, counts, percentages, data
- **UI**: System UI (400-600 weight) — body text, labels, descriptions
- **Serif**: Iowan Old Style — reserved for journaling/personal notes

### Glass Morphism
Components use iOS-style liquid glass effect:
- Backdrop blur (12px)
- Saturate filter (180%)
- Transparent tinted background
- Subtle shine/border effects

## Next Steps

1. **Replace existing App.css styles** with design tokens where applicable
2. **Update existing components** to use new CSS custom properties
3. **Add AtlasMobileRedesign to routing** to see the complete design
4. **Integrate real data** into the screen components (events, observations, etc.)
5. **Wire up navigation** to actual routes and app logic
6. **Implement image slots** for astronomy photos with drag-and-drop

## Testing the Redesign

To see the redesign in action, temporarily add it to your App:

```tsx
import { AtlasMobileRedesign } from './components'

// In your App component, render:
return <AtlasMobileRedesign isDark={true} />
```

Then toggle between light and dark themes using the buttons in the header.

## Notes

- All components use CSS custom properties for theming
- No hardcoded colors — uses `var(--*)` throughout
- Responsive design adjusts for mobile (max-width: 640px)
- Accessibility preserved: semantic HTML, sufficient contrast, keyboard navigation
- Fonts are local (woff2) — no external network requests required
