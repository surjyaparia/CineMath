import { useState, useEffect } from 'react'

const EXAMPLES = [
  'e^(i*phi) = cos(phi) + i*sin(phi)',
  'z = sin(x) * cos(y)',
  'y = sin(x) / x',
  'z = x^2 + y^2',
  'e^(i*2*phi)',
  'y = cos(x) * e^(-x/4)',
]

const TYPE_LABELS = {
  '2d': '2D',
  '3d': '3D Surface',
  parametric: 'Parametric',
  euler: 'Euler / Complex',
}

export default function InputBox({ value, onChange, onPlot, disabled, error, detectedType }) {
  const [exIdx, setExIdx] = useState(0)
  const [plotting, setPlotting] = useState(false)

  // Rotate placeholder every 3s
  useEffect(() => {
    const id = setInterval(() => setExIdx((i) => (i + 1) % EXAMPLES.length), 3000)
    return () => clearInterval(id)
  }, [])

  const handlePlot = () => {
    setPlotting(true)
    setTimeout(() => setPlotting(false), 420)
    onPlot()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
      <div className={`equation-bar-inner${error ? ' has-error' : ''}`}>
        <input
          id="equation"
          className="equation-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) handlePlot() }}
          placeholder={`e.g. ${EXAMPLES[exIdx]}`}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'eq-error' : undefined}
        />
        {detectedType && (
          <span className="eq-type-pill" key={detectedType}>
            {TYPE_LABELS[detectedType] ?? detectedType}
          </span>
        )}
      </div>
      {error && (
        <p id="eq-error" className="input-error" role="alert">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  )
}
