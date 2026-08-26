# Atlas Mobile Redesign — Action Items

## ✅ Completed

- [x] Extracted markup and styling from Claude Design `.dc.html`
- [x] Created iOS device frame component with status bar and home indicator
- [x] Built complete mobile redesign with 5-tab navigation
- [x] Implemented comprehensive design system with CSS custom properties
- [x] Created light and dark theme support
- [x] Set up responsive layouts for mobile screens
- [x] Integrated Turret Road and Oxanium fonts
- [x] Added all astronomy category colors
- [x] Components pass TypeScript compilation
- [x] Build succeeds without errors
- [x] Created documentation and guides

## 🎯 Next Steps

### Immediate (Ready to integrate)
1. **View the redesign in action**
   ```bash
   # Temporarily swap in the redesign to see it working
   # Edit src/App.tsx and import:
   import { AtlasMobileRedesign } from './components'
   # Then render: <AtlasMobileRedesign isDark={true} />
   ```

2. **Update existing components** to use design tokens
   - Replace hardcoded colors with `var(--*)`
   - Update fonts to use `var(--disp)`, `var(--num)`, `var(--ui)`
   - Inherit theme awareness

3. **Test theme switching**
   - Verify light/dark theme toggle works
   - Check all components render correctly in both themes
   - Ensure contrast ratios meet WCAG standards

### Short term (1-2 weeks)
4. **Wire real data** into redesign components
   - Connect events API to "Tonight" screen
   - Load location data into location sheet
   - Fetch observations for Journal screen
   - Implement search/filter for Explore screen

5. **Implement missing interactions**
   - Location chip dropdown to full sheet modal
   - Mode switcher (naked eye/binoculars/telescope) filtering logic
   - Conditions chart animation/interactivity
   - Event item tap-through to detail view

6. **Add image slots** for astronomy photos
   - Use existing `<image-slot>` component pattern
   - Set up drag-and-drop for event/observation photos
   - Implement photo library or search integration

### Medium term (3-4 weeks)
7. **Migrate existing routes** to new design
   - Replace old navigation bar with 5-tab system
   - Update existing pages to use new layout
   - Integrate Plan, Settings screens with real features

8. **Enhance animations**
   - Add starfield parallax to background
   - Smooth tab transitions
   - Conditions chart animations
   - Modal sheet interactions

9. **Polish and refine**
   - Test on real devices (iOS/Android)
   - Gather feedback and iterate
   - Accessibility audit (keyboard nav, screen readers)
   - Performance optimization

## File Reference

### Core Components
- `src/components/IOSDevice.tsx` — iOS frame wrapper
- `src/components/AtlasMobileRedesign.tsx` — Main redesign with 5 tabs
- `src/components/index.ts` — Component exports

### Styling
- `src/design-tokens.css` — Design system (colors, fonts, tokens)
- `src/styles/ios-device.css` — iOS frame styles
- `src/styles/atlas-redesign.css` — Redesign layout & styling

### Documentation
- `REDESIGN_GUIDE.md` — Integration guide & feature overview
- `REDESIGN_IMPLEMENTATION_SUMMARY.md` — What was built
- `REDESIGN_ACTION_ITEMS.md` — Next steps (this file)

## Quick Start

### To see the redesign:
```tsx
import { AtlasMobileRedesign } from './components'

export function App() {
  return <AtlasMobileRedesign isDark={true} />
}
```

### To use design tokens in your CSS:
```css
:root {
  @import './design-tokens.css';
}

.my-button {
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--num);
  border: 1px solid var(--line);
}
```

### To switch themes:
```tsx
// Set on html element
document.documentElement.dataset.atlasTheme = 'light' // or 'dark'
```

## Build Status

- ✅ TypeScript: No errors
- ✅ CSS: Valid and complete
- ✅ Build: Passes `npm run build`
- ✅ Fonts: Loaded and available
- ✅ Components: Ready for use

## Questions or Issues?

Refer to:
- **How do I use a component?** → See REDESIGN_GUIDE.md
- **What files were created?** → See REDESIGN_IMPLEMENTATION_SUMMARY.md
- **Where do I start integrating?** → See Next Steps above
- **Why is a specific color used?** → Check design-tokens.css comments

## Success Criteria

When the redesign is fully integrated, the app should:
- [ ] Render all 5 tabs (Tonight, Explore, Plan, Journal, Settings)
- [ ] Support light and dark themes throughout
- [ ] Use new typography system (Turret Road, Oxanium)
- [ ] Display astronomy events with correct category colors
- [ ] Support location switching via modal sheet
- [ ] Show observation journal with photo attachments
- [ ] Maintain existing functionality (all routes, auth, etc.)
- [ ] Pass accessibility tests (WCAG 2.1 AA)
- [ ] Perform well on mobile devices
