import { AtlasMinimalApp } from './AtlasMinimalApp'

export function AtlasMinimalPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#e4e2dc', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, height: '100vh', boxShadow: '0 0 60px rgba(0,0,0,0.25)' }}>
        <AtlasMinimalApp />
      </div>
    </div>
  )
}
