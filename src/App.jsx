import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import InputBox from './components/InputBox.jsx'
import Graph2D from './components/Graph2D.jsx'
import Graph3D from './components/Graph3D.jsx'
import InsightPanel from './components/InsightPanel.jsx'
import {
  detectEquationType,
  parseEquation,
  sampleCompiledFunction,
  sampleCompiledSurface,
} from './utils/parser.js'
import { getInsight } from './utils/insightEngine.js'

const INITIAL = 'e^(i*phi) = cos(phi) + i*sin(phi)'

const TYPE_LABELS = {
  '2d':       '2D function',
  '3d':       '3D surface',
  parametric: 'Parametric curve',
  euler:      'Euler / helix',
}

const TYPE_VIEWS = {
  '2d':       ['2d'],
  '3d':       ['3d'],
  parametric: ['parametric', '2d'],
  euler:      ['parametric', '3d'],
}

const VIEW_LABELS = {
  '2d':       '2D Graph',
  '3d':       '3D Surface',
  parametric: 'Parametric',
}

// Suggest corrections for common typos in math expressions
function detectTypo(eq) {
  const known = ['sin', 'cos', 'tan', 'log', 'sqrt', 'exp', 'abs', 'ceil', 'floor']
  const typoMap = {}
  for (const fn of known) {
    // build all 1-char substitutions of the function name
    for (let i = 0; i < fn.length; i++) {
      for (let c = 97; c <= 122; c++) {
        const variant = fn.slice(0, i) + String.fromCharCode(c) + fn.slice(i + 1)
        if (variant !== fn) typoMap[variant] = fn
      }
    }
  }
  const lower = eq.toLowerCase()
  for (const [typo, correct] of Object.entries(typoMap)) {
    const re = new RegExp(`\\b${typo}\\s*\\(`, 'i')
    if (re.test(lower)) {
      const actual = eq.match(new RegExp(`\\b${typo}\\b`, 'i'))?.[0] ?? typo
      return `Did you mean ${correct}() instead of ${actual}()?`
    }
  }
  return null
}

export default function App() {
  const [equation, setEquation]       = useState(INITIAL)
  const [error, setError]             = useState('')
  const [series2d, setSeries2d]       = useState([])
  const [points3d, setPoints3d]       = useState([])
  const [plottedEq, setPlottedEq]     = useState('')
  const [viewMode, setViewMode]       = useState('parametric')
  const [visible, setVisible]         = useState(true)
  const [plotting, setPlotting]       = useState(false)
  const [phi, setPhi]                 = useState(0)
  const [curveMode, setCurveMode]     = useState('helix')
  const [scaleFactor, setScaleFactor] = useState(0.2)
  const [cinematic, setCinematic]     = useState(false)

  // Escape exits cinematic mode
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setCinematic(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Always-current ref so plot() never captures a stale equation
  const equationRef = useRef(equation)
  useEffect(() => { equationRef.current = equation }, [equation])

  const detectedType   = detectEquationType(equation)
  const insight        = getInsight(equation, detectedType)
  const availableViews = useMemo(() => TYPE_VIEWS[detectedType] ?? [], [detectedType])
  const isParametric   = viewMode === 'parametric'

  const plot = useCallback((eqOverride) => {
    const eq = eqOverride ?? equationRef.current
    setError('')
    setPlotting(true)
    setTimeout(() => setPlotting(false), 420)

    const parsed = parseEquation(eq)
    if (!parsed.ok) {
      setError(parsed.error)
      setSeries2d([])
      setPoints3d([])
      return
    }
    try {
      if (parsed.mode === '2d') {
        const sampled = sampleCompiledFunction(parsed.compiled, -10, 10, 401)
        if (!sampled.length) {
          const typoHint = detectTypo(eq)
          setError(typoHint || 'No finite y values in [−10, 10]. Try another expression.')
          return
        }
        setViewMode('2d')
        setSeries2d([{ label: parsed.expression, points: sampled, color: 'rgb(99,102,241)' }])
        setPoints3d([])
      } else if (parsed.mode === 'complex3d') {
        setViewMode('parametric')
        setSeries2d([])
        setPoints3d([])
      } else {
        const surface = sampleCompiledSurface(parsed.compiled, -10, 10, 61)
        if (!surface.length) {
          const typoHint = detectTypo(eq)
          setError(typoHint || 'No finite z values in the sampled grid. Try another expression.')
          return
        }
        setViewMode('3d')
        setPoints3d(surface)
        setSeries2d([])
      }
      setPlottedEq(eq)
      setVisible(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not evaluate expression.')
    }
  }, []) // stable — reads equation via ref

  // Auto-plot the initial equation on mount
  useEffect(() => { plot(INITIAL) }, [plot])

  const handleChange = useCallback((val) => { setEquation(val); setError('') }, [])

  const switchView = useCallback((next) => {
    setVisible(false)
    setTimeout(() => { setViewMode(next); setVisible(true) }, 200)
  }, [])

  const graphNode = useMemo(() => {
    if (viewMode === 'parametric') {
      return (
        <Graph3D
          points={[]}
          expression={plottedEq || equation}
          onPhiChange={setPhi}
          onCurveModeChange={setCurveMode}
          onScaleFactorChange={setScaleFactor}
          cinematic={cinematic}
        />
      )
    }
    if (viewMode === '3d') {
      return <Graph3D points={points3d} expression={plottedEq || equation} cinematic={cinematic} />
    }
    return <Graph2D series={series2d} />
  }, [viewMode, series2d, points3d, plottedEq, equation, cinematic])

  return (
    <div className={`app${cinematic ? ' cinematic' : ''}`}>
      <header className="app-header">
        <div className={`header-brand${cinematic ? ' header-brand--hidden' : ''}`}>
          <button 
            className="header-brand-button"
            onClick={() => {
              window.location.reload()
            }}
          >
            <div className="header-logo">
              <img src="/favicon.svg" alt="Math Visualizer" />
            </div>
            <h1>Math Visualizer</h1>
          </button>
        </div>
        <span className="header-tag">3D · Parametric · Euler</span>
        <button
          type="button"
          className={`cinematic-btn${cinematic ? ' cinematic-btn--active' : ''}`}
          onClick={() => setCinematic((c) => !c)}
        >
          {cinematic ? '✕ Exit' : '✦ Cinematic'}
        </button>
      </header>

      <div className="app-workspace">

        <div className="equation-bar">
          <InputBox
            value={equation}
            onChange={handleChange}
            onPlot={plot}
            disabled={false}
            error={error}
            detectedType={detectedType}
          />
          <button
            type="button"
            className={`plot-btn${plotting ? ' plotting' : ''}`}
            onClick={(e) => {
              // Ripple
              const btn = e.currentTarget
              const circle = document.createElement('span')
              const diameter = Math.max(btn.clientWidth, btn.clientHeight)
              const rect = btn.getBoundingClientRect()
              circle.style.cssText = `
                width:${diameter}px;height:${diameter}px;
                left:${e.clientX - rect.left - diameter/2}px;
                top:${e.clientY - rect.top  - diameter/2}px;
              `
              circle.className = 'btn-ripple'
              btn.querySelector('.btn-ripple')?.remove()
              btn.appendChild(circle)
              setTimeout(() => circle.remove(), 600)
              plot()
            }}
          >
            Plot →
          </button>
        </div>

        <div className="content-area">

          <div className="canvas-column">
            <div className="canvas-toolbar">
              {availableViews.length > 1 && (
                <div className="view-tabs">
                  {availableViews.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`view-tab${viewMode === v ? ' active' : ''}`}
                      onClick={() => switchView(v)}
                    >
                      {VIEW_LABELS[v]}
                    </button>
                  ))}
                </div>
              )}
              {detectedType && (
                <span className="canvas-hint">Detected: {TYPE_LABELS[detectedType]}</span>
              )}
            </div>

            <div
              className={`view-container${visible ? ' view-visible' : ' view-hidden'}`}
            >
              {graphNode}
            </div>
          </div>

          <aside className="info-panel">
            <InsightPanel
              insight={insight}
              phi={isParametric ? phi : undefined}
              curveMode={curveMode}
              scaleFactor={scaleFactor}
            />
            {!insight && (
              <div className="panel-card" style={{ color: 'var(--text-3)', fontSize: '0.82rem', textAlign: 'center', padding: '2.5rem 1rem' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem', opacity: 0.2 }}>∿</div>
                Enter an equation and press Plot
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
