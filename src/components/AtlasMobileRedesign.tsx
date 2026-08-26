import React, { useState } from 'react'
import '../styles/atlas-redesign.css'

interface AtlasMobileRedesignProps {
  isDark?: boolean
}

export const AtlasMobileRedesign: React.FC<AtlasMobileRedesignProps> = ({ isDark = true }) => {
  const [activeTab, setActiveTab] = useState<'tonight' | 'explore' | 'plan' | 'journal' | 'settings'>('tonight')
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>(isDark ? 'dark' : 'light')
  const [locationOpen, setLocationOpen] = useState(false)

  return (
    <div className={`atlas-mobile-redesign ${currentTheme}`}>
      <div className="atlas-starfield" />
      <div className="atlas-overlay" />

      <div className="atlas-container">
        {/* Header */}
        <div className="atlas-header">
          <div className="atlas-header-title">
            <span className="atlas-title-text">Atlas mobile</span>
            <span className="atlas-subtitle-text">Turn 2 consolidated design · dark & light</span>
          </div>
          <div className="atlas-theme-toggle">
            <button
              className={`atlas-theme-btn ${currentTheme === 'dark' ? 'active' : ''}`}
              onClick={() => setCurrentTheme('dark')}
            >
              Dark
            </button>
            <button
              className={`atlas-theme-btn ${currentTheme === 'light' ? 'active' : ''}`}
              onClick={() => setCurrentTheme('light')}
            >
              Light
            </button>
          </div>
        </div>

        {/* Main screen */}
        <div className="atlas-screen-wrapper">
          {/* Tonight screen */}
          {activeTab === 'tonight' && (
            <div className="atlas-screen atlas-tonight-screen">
              <div className="atlas-screen-header">
                <button className="atlas-location-chip" onClick={() => setLocationOpen(!locationOpen)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
                    <circle cx="12" cy="9.5" r="2.4" />
                  </svg>
                  <span>London</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="m9 5 7 7-7 7" transform="rotate(90 12 12)" />
                  </svg>
                </button>
                <div style={{ flex: 1 }} />
                <span className="atlas-moon-info">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-moon)" strokeWidth="1.9">
                    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
                  </svg>
                  41%
                </span>
                <span className="atlas-time-text">20:12</span>
              </div>

              <div className="atlas-event-hero">
                <span className="atlas-event-title">Go</span>
                <span className="atlas-event-time">21:40–23:55</span>
                <span className="atlas-clear-badge">68% CLEAR</span>
              </div>

              <div className="atlas-conditions-chart">
                <div className="atlas-bar" style={{ height: '26%', background: 'var(--bad)', opacity: 0.8 }} />
                <div className="atlas-bar" style={{ height: '44%', background: 'var(--warn)', opacity: 0.8 }} />
                <div className="atlas-bar" style={{ height: '78%', background: 'var(--go)' }} />
                <div className="atlas-bar" style={{ height: '100%', background: 'var(--go)' }} />
                <div className="atlas-bar" style={{ height: '92%', background: 'var(--go)' }} />
                <div className="atlas-bar" style={{ height: '40%', background: 'var(--warn)', opacity: 0.8 }} />
                <div className="atlas-bar" style={{ height: '22%', background: 'var(--bad)', opacity: 0.8 }} />
              </div>

              <div className="atlas-mode-switcher">
                <button className="atlas-mode-btn active">Naked eye</button>
                <button className="atlas-mode-btn">Binoculars</button>
                <button className="atlas-mode-btn">Telescope</button>
              </div>

              <div className="atlas-events-list">
                <div className="atlas-event-item">
                  <div className="atlas-event-icon" style={{ borderLeftColor: 'var(--c-planet)' }} />
                  <div className="atlas-event-content">
                    <span className="atlas-event-category">PLANETS · PRIME</span>
                    <span className="atlas-event-name">Saturn at opposition</span>
                    <span className="atlas-event-desc">Brightest until 2027. Southeast, 24°.</span>
                  </div>
                  <span className="atlas-event-time">22:18</span>
                </div>
                <div className="atlas-event-item">
                  <div className="atlas-event-icon" style={{ borderLeftColor: 'var(--c-sat)' }} />
                  <div className="atlas-event-content">
                    <span className="atlas-event-category">SATELLITES</span>
                    <span className="atlas-event-name">ISS pass, 61° overhead</span>
                    <span className="atlas-event-desc">WSW to ENE, 4 min 20 s.</span>
                  </div>
                  <span className="atlas-event-time">22:41</span>
                </div>
              </div>
            </div>
          )}

          {/* Explore screen */}
          {activeTab === 'explore' && (
            <div className="atlas-screen atlas-explore-screen">
              <div className="atlas-explore-header">
                <span className="atlas-explore-title">Explore</span>
              </div>
              <div className="atlas-search-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4.6-4.6" />
                </svg>
                <span>Events, targets, cities</span>
              </div>
              <div className="atlas-filter-tags">
                <button className="atlas-tag active">All 14</button>
                <button className="atlas-tag">Moon 4</button>
                <button className="atlas-tag">Deep sky 6</button>
                <button className="atlas-tag">Meteors 2</button>
              </div>
              <p style={{ color: 'var(--fg2)', fontSize: '12px', padding: '0 16px', marginTop: 16 }}>Sky Pass unlocks browsing events in other locations — you're seeing London.</p>
            </div>
          )}

          {/* Journal screen */}
          {activeTab === 'journal' && (
            <div className="atlas-screen atlas-journal-screen">
              <div className="atlas-journal-header">
                <h2 style={{ margin: 0, fontFamily: 'var(--disp)', fontSize: 28, fontWeight: 800, color: 'var(--fg)' }}>
                  Journal
                </h2>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', fontFamily: 'var(--num)' }}>
                  37 ENTRIES · 5 NIGHT STREAK
                </span>
              </div>
              <div className="atlas-journal-tabs">
                <button className="atlas-journal-tab active">Private</button>
                <button className="atlas-journal-tab">Archive</button>
                <button className="atlas-journal-tab">Public</button>
              </div>
              <p style={{ color: 'var(--fg2)', fontSize: '12px', padding: '16px', marginTop: 16 }}>
                Your observation logs will appear here.
              </p>
            </div>
          )}

          {/* Location Sheet */}
          {locationOpen && (
            <div className="atlas-sheet-overlay">
              <div className="atlas-sheet-content">
                <div className="atlas-sheet-header">
                  <span className="atlas-sheet-title">Observing from</span>
                  <button className="atlas-sheet-close" onClick={() => setLocationOpen(false)}>
                    Done
                  </button>
                </div>
                <div className="atlas-search-input">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4.6-4.6" />
                  </svg>
                  <span>Search a town or city</span>
                </div>
                <div className="atlas-location-list">
                  <button className="atlas-location-item active">
                    <div className="atlas-location-dot" />
                    <span>London</span>
                    <span className="atlas-location-meta">BORTLE 8 · 68%</span>
                  </button>
                  <button className="atlas-location-item">
                    <div className="atlas-location-dot" />
                    <span>Kent — Elham Valley</span>
                    <span className="atlas-location-meta">BORTLE 4 · 74%</span>
                  </button>
                  <button className="atlas-location-item">
                    <div className="atlas-location-dot" />
                    <span>Brecon Beacons</span>
                    <span className="atlas-location-meta">BORTLE 3 · 41%</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation bar */}
        <div className="atlas-nav-bar">
          <button className={`atlas-nav-item ${activeTab === 'tonight' ? 'active' : ''}`} onClick={() => setActiveTab('tonight')}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18" />
              <path d="M8 3v4M16 3v4" />
            </svg>
            <span>Tonight</span>
          </button>
          <button className={`atlas-nav-item ${activeTab === 'explore' ? 'active' : ''}`} onClick={() => setActiveTab('explore')}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4.6-4.6" />
            </svg>
            <span>Explore</span>
          </button>
          <button className={`atlas-nav-item ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
              <path d="M9 4v14M15 6v14" />
            </svg>
            <span>Plan</span>
          </button>
          <button className={`atlas-nav-item ${activeTab === 'journal' ? 'active' : ''}`} onClick={() => setActiveTab('journal')}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5Z" />
              <path d="M4 4.5v16" />
            </svg>
            <span>Journal</span>
          </button>
          <button className={`atlas-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82-.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  )
}
