import { useEffect, useRef, useState } from 'react'

// Lerps a displayed number toward the real value every animation frame.
// speed: 0–1, higher = faster catch-up (0.12 feels smooth without lag)
function useAnimatedNumber(target, speed = 0.12) {
  const [display, setDisplay] = useState(target ?? 0)
  const current = useRef(target ?? 0)
  const raf     = useRef(null)

  useEffect(() => {
    if (target == null) return
    const animate = () => {
      const diff = target - current.current
      if (Math.abs(diff) < 0.0001) {
        current.current = target
        setDisplay(target)
        return
      }
      current.current += diff * speed
      setDisplay(current.current)
      raf.current = requestAnimationFrame(animate)
    }
    raf.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf.current)
  }, [target, speed])

  return display
}

function CardIcon({ symbol, gradient }) {
  return (
    <div className="pc-icon" style={{ background: gradient }}>
      {symbol}
    </div>
  )
}

function Separator() {
  return <div className="pc-sep" />
}

function CoordPill({ label, value, color }) {
  const animated = useAnimatedNumber(value, 0.1)
  return (
    <div className="coord-pill" style={{ '--pill-accent': color }}>
      <span className="coord-pill-lbl">{label}</span>
      <span className="coord-pill-val">{animated.toFixed(3)}</span>
    </div>
  )
}

export default function InsightPanel({ insight, phi, curveMode, scaleFactor }) {
  if (!insight) return null

  const showLive = phi !== undefined
  const x = showLive ? Math.cos(phi) : null
  const y = showLive ? Math.sin(phi) : null
  const z = showLive && curveMode === 'helix' ? phi * scaleFactor : showLive ? 0 : null

  const animPhi = useAnimatedNumber(showLive ? phi : null, 0.1)

  return (
    <div className="info-panel-inner">

      {/* ── 1. Equation ── */}
      <div className="pc pc-eq">
        <div className="pc-header">
          <CardIcon symbol="∫" gradient="linear-gradient(135deg,#6366f1,#818cf8)" />
          <span className="pc-label">Equation</span>
        </div>
        <Separator />
        <div className="pc-formula">{insight.formula}</div>
      </div>

      {/* ── 2. Parametric form ── */}
      <div className="pc pc-param">
        <div className="pc-header">
          <CardIcon symbol="⟳" gradient="linear-gradient(135deg,#a855f7,#c084fc)" />
          <span className="pc-label">Parametric Form</span>
        </div>
        <Separator />
        <div className="pc-prop-list">
          {insight.properties.map((p) => (
            <div key={p.label} className="pc-prop-row">
              <span className="pc-prop-key">{p.label}</span>
              <span className="pc-prop-val">{p.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Live values ── */}
      {showLive && (
        <div className="pc pc-live">
          <div className="pc-header">
            <CardIcon symbol="◎" gradient="linear-gradient(135deg,#ec4899,#f0abfc)" />
            <span className="pc-label">Current Values</span>
          </div>
          <Separator />
          <div className="pc-phi-wrap">
            <span className="pc-phi-glow">{animPhi.toFixed(4)}</span>
            <span className="pc-phi-sub">φ · angle parameter</span>
          </div>
          <div className="pc-coords">
            <CoordPill label="x" value={x} color="#38bdf8" />
            <CoordPill label="y" value={y} color="#4ade80" />
            <CoordPill label="z" value={z} color="#f472b6" />
          </div>
        </div>
      )}

      {/* ── 4. Insight ── */}
      <div className="pc pc-insight">
        <div className="pc-header">
          <CardIcon symbol="✦" gradient="linear-gradient(135deg,#0ea5e9,#38bdf8)" />
          <span className="pc-label">Mathematical Insight</span>
        </div>
        <Separator />
        <div className="pc-insight-head">
          <span className="pc-type-badge">{insight.type}</span>
          <span className="pc-insight-title">{insight.title}</span>
        </div>
        <div className="pc-insight-formula">{insight.formula}</div>
        <p className="pc-insight-explanation">{insight.explanation}</p>
      </div>

    </div>
  )
}
