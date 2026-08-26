import React from 'react'
import '../styles/ios-device.css'

interface IOSDeviceProps {
  children?: React.ReactNode
  width?: number
  height?: number
  dark?: boolean
  title?: string
}

export const IOSDevice: React.FC<IOSDeviceProps> = ({
  children,
  width = 402,
  height = 874,
  dark = false,
  title,
}) => {
  const bgColor = dark ? '#000' : '#F2F2F7'

  return (
    <div
      className="ios-device"
      style={{
        width,
        height,
        borderRadius: 48,
        overflow: 'hidden',
        position: 'relative',
        background: bgColor,
        boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
        fontFamily: '-apple-system, system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Dynamic island */}
      <div
        style={{
          position: 'absolute',
          top: 11,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 126,
          height: 37,
          borderRadius: 24,
          background: '#000',
          zIndex: 50,
        }}
      />

      {/* Status bar */}
      <IOSStatusBar dark={dark} />

      {/* Nav + content */}
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {title !== undefined && <IOSNavBar title={title} dark={dark} />}
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
      </div>

      {/* Home indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          height: 34,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          paddingBottom: 8,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 139,
            height: 5,
            borderRadius: 100,
            background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)',
          }}
        />
      </div>
    </div>
  )
}

interface IOSStatusBarProps {
  dark?: boolean
  time?: string
}

const IOSStatusBar: React.FC<IOSStatusBarProps> = ({ dark = false, time = '9:41' }) => {
  const color = dark ? '#fff' : '#000'
  return (
    <div
      style={{
        display: 'flex',
        gap: 154,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '21px 24px 19px',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 20,
        width: '100%',
      }}
    >
      <div style={{ flex: 1, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 1.5 }}>
        <span
          style={{
            fontFamily: '-apple-system, "SF Pro", system-ui',
            fontWeight: 590,
            fontSize: 17,
            lineHeight: '22px',
            color,
          }}
        >
          {time}
        </span>
      </div>
      <div style={{ flex: 1, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, paddingTop: 1, paddingRight: 1 }}>
        {/* Signal */}
        <svg width="19" height="12" viewBox="0 0 19 12">
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill={color} />
          <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill={color} />
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill={color} />
          <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill={color} />
        </svg>
        {/* WiFi */}
        <svg width="17" height="12" viewBox="0 0 17 12">
          <path
            d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z"
            fill={color}
          />
          <path
            d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z"
            fill={color}
          />
          <circle cx="8.5" cy="10.5" r="1.5" fill={color} />
        </svg>
        {/* Battery */}
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={color} strokeOpacity="0.35" fill="none" />
          <rect x="2" y="2" width="20" height="9" rx="2" fill={color} />
          <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill={color} fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  )
}

interface IOSNavBarProps {
  title?: string
  dark?: boolean
  trailingIcon?: boolean
}

const IOSNavBar: React.FC<IOSNavBarProps> = ({ title = 'Title', dark = false, trailingIcon = true }) => {
  const muted = dark ? 'rgba(255,255,255,0.6)' : '#404040'
  const text = dark ? '#fff' : '#000'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingTop: 62,
        paddingBottom: 10,
        position: 'relative',
        zIndex: 5,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        {/* Back chevron */}
        <IOSGlassPill dark={dark}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" style={{ marginLeft: -1 }}>
            <path d="M10 2L2 10l8 8" stroke={muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IOSGlassPill>

        {/* Trailing ellipsis */}
        {trailingIcon && (
          <IOSGlassPill dark={dark}>
            <svg width="22" height="6" viewBox="0 0 22 6">
              <circle cx="3" cy="3" r="2.5" fill={muted} />
              <circle cx="11" cy="3" r="2.5" fill={muted} />
              <circle cx="19" cy="3" r="2.5" fill={muted} />
            </svg>
          </IOSGlassPill>
        )}
      </div>

      {/* Large title */}
      <div
        style={{
          padding: '0 16px',
          fontFamily: '-apple-system, system-ui',
          fontSize: 34,
          fontWeight: 700,
          lineHeight: '41px',
          color: text,
          letterSpacing: 0.4,
        }}
      >
        {title}
      </div>
    </div>
  )
}

interface IOSGlassPillProps {
  children?: React.ReactNode
  dark?: boolean
  style?: React.CSSProperties
}

const IOSGlassPill: React.FC<IOSGlassPillProps> = ({ children, dark = false, style = {} }) => {
  return (
    <div
      style={{
        height: 44,
        minWidth: 44,
        borderRadius: 9999,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: dark
          ? '0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)'
          : '0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)',
        ...style,
      }}
    >
      {/* blur + tint */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 9999,
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          background: dark ? 'rgba(120,120,128,0.28)' : 'rgba(255,255,255,0.5)',
        }}
      />
      {/* shine */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 9999,
          boxShadow: dark
            ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)'
            : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
          border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', padding: '0 4px' }}>
        {children}
      </div>
    </div>
  )
}
