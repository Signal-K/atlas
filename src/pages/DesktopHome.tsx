import { Starfield } from '../components/mobile/Starfield'

export function DesktopHome() {
  return (
    <div className="desktop-starfield">
      <Starfield dark palette="mono" motion="static" density={80} />
    </div>
  )
}
